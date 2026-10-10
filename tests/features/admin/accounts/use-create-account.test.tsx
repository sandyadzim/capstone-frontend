// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'
import { expireSession, sessionKey } from '@/features/auth/auth-session'
import { useCreateAccount } from '@/features/admin/accounts/hooks/use-create-account'
import { accountsKey } from '@/features/admin/accounts/account-queries'
import { residentsKey } from '@/features/admin/units/unit-queries'
import { admin } from '../settings/fixtures'
import { account } from './fixtures'

const original = apiClient.defaults.adapter
const values = {
  name: 'Alex',
  loginIdentifier: 'alex',
  password: 'password1234',
  role: 'RESIDENT' as const,
  isActive: true,
}
afterEach(() => {
  apiClient.defaults.adapter = original
  toast.close()
})

function setup() {
  const client = createQueryClient()
  client.setQueryData(sessionKey, admin)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...renderHook(() => useCreateAccount(), { wrapper }) }
}

it('invalidates account lists and Resident options and drops completed mutation credentials', async () => {
  apiClient.defaults.adapter = async (config) => ({
    data: account,
    status: 201,
    statusText: 'Created',
    headers: {},
    config,
  })
  const { client, result } = setup()
  const listKey = [...accountsKey, 'list', {}]
  client.setQueryData(listKey, { old: true })
  client.setQueryData(residentsKey, { old: true })
  await act(async () => {
    expect(await result.current.create(values)).toEqual(account)
  })
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState(residentsKey)?.isInvalidated).toBe(true)
  await waitFor(() =>
    expect(client.getMutationCache().getAll()).toHaveLength(0),
  )
  client.clear()
})

it.each(['unmount', 'session'] as const)(
  'blocks overlapping writes and suppresses a completion after %s',
  async (ending) => {
    let finish!: () => void
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    let signal: AbortSignal | undefined
    const calls = vi.fn()
    apiClient.defaults.adapter = async (config) => {
      calls()
      signal = config.signal as AbortSignal
      await gate
      return {
        data: account,
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      }
    }
    const { client, result, unmount } = setup()
    const feedback = vi.spyOn(toast, 'add')
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    let pending!: ReturnType<typeof result.current.create>
    act(() => {
      pending = result.current.create(values)
    })
    await waitFor(() => expect(calls).toHaveBeenCalledTimes(1))
    await act(async () => {
      expect(await result.current.create(values)).toBeUndefined()
      if (ending === 'unmount') unmount()
      else await expireSession(client)
      finish()
      expect(await pending).toBeUndefined()
    })
    if (ending === 'unmount') expect(signal?.aborted).toBe(true)
    expect(calls).toHaveBeenCalledTimes(1)
    expect(feedback).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    client.clear()
  },
)

it('does not retry failed writes and drops failed mutation credentials', async () => {
  const failure = new ApiError('Unavailable', 'INTERNAL_ERROR', 500)
  const calls = vi.fn()
  apiClient.defaults.adapter = async () => {
    calls()
    throw failure
  }
  const { client, result } = setup()
  await act(async () => {
    await expect(result.current.create(values)).rejects.toBe(failure)
  })
  expect(calls).toHaveBeenCalledTimes(1)
  await waitFor(() =>
    expect(client.getMutationCache().getAll()).toHaveLength(0),
  )
  client.clear()
})

it('uses central 401 handling without treating an expired session as an ordinary form failure', async () => {
  apiClient.defaults.adapter = async () => {
    throw new ApiError('Expired', 'UNAUTHORIZED', 401)
  }
  const { client, result } = setup()
  await act(async () => {
    expect(await result.current.create(values)).toBeUndefined()
  })
  expect(client.getQueryData(sessionKey)).toBeNull()
  client.clear()
})

it('keeps successful creation successful when refreshing an observed list fails', async () => {
  apiClient.defaults.adapter = async (config) => ({
    data: account,
    status: 201,
    statusText: 'Created',
    headers: {},
    config,
  })
  const { client, result } = setup()
  // Query invalidation's default behavior resolves even if a refetch rejects.
  const { QueryObserver } = await import('@tanstack/react-query')
  const key = [...accountsKey, 'list', {}]
  client.setQueryData(key, { old: true })
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => {
      throw new Error('Read failed')
    },
    retry: false,
    staleTime: Infinity,
  })
  const unsubscribe = observer.subscribe(() => undefined)
  const feedback = vi.spyOn(toast, 'add')
  await act(async () => {
    expect(await result.current.create(values)).toEqual(account)
  })
  expect(client.getQueryState(key)?.status).toBe('error')
  expect(feedback).toHaveBeenCalledWith({
    title: 'Account created',
    type: 'success',
  })
  unsubscribe()
  client.clear()
})
