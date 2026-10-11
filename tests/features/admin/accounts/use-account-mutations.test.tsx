// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'
import {
  expireSession,
  sessionKey,
  sessionExpired,
  sessionGeneration,
} from '@/features/auth/auth-session'
import { useAccountMutations } from '@/features/admin/accounts/hooks/use-account-mutations'
import {
  accountsKey,
  accountDetailKey,
} from '@/features/admin/accounts/account-queries'
import { unitsKey, residentsKey } from '@/features/admin/units/unit-queries'
import { admin } from '../settings/fixtures'
import { account } from './fixtures'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  toast.close()
})
function setup(id = account.id) {
  const client = createQueryClient()
  client.setQueryData(sessionKey, admin)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...renderHook(() => useAccountMutations(id), { wrapper }) }
}

it.each(['activate', 'deactivate', 'role'] as const)(
  'refreshes account and Unit caches after %s',
  async (kind) => {
    const calls = vi.fn()
    const saved = {
      ...account,
      activeUnit: null,
      role: kind === 'role' ? 'TECHNICIAN' : account.role,
      isActive: kind !== 'deactivate',
    }
    apiClient.defaults.adapter = async (config) => {
      calls(config)
      return { data: saved, status: 200, statusText: 'OK', headers: {}, config }
    }
    const { client, result } = setup()
    const listKey = [...accountsKey, 'list', {}]
    client.setQueryData(listKey, { old: true })
    client.setQueryData(residentsKey, { old: true })
    client.setQueryData(unitsKey, { old: true })
    await act(async () => {
      if (kind === 'role') await result.current.update({ role: 'TECHNICIAN' })
      else await result.current[kind]()
    })
    expect(client.getQueryData(accountDetailKey(account.id))).toEqual(saved)
    for (const key of [listKey, residentsKey, unitsKey])
      expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    const config = calls.mock.calls[0][0]
    if (kind === 'deactivate') expect(config.url).toMatch(/\/deactivate$/)
    else
      expect(JSON.parse(config.data)).toEqual(
        kind === 'activate' ? { isActive: true } : { role: 'TECHNICIAN' },
      )
    await waitFor(() =>
      expect(client.getMutationCache().getAll()).toHaveLength(0),
    )
    client.clear()
  },
)

it('updates the current actor after an identity edit without expiring the session', async () => {
  const saved = {
    ...account,
    ...admin,
    name: 'New Admin',
    loginIdentifier: 'new-admin',
  }
  apiClient.defaults.adapter = async (config) => ({
    data: saved,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  const { client, result } = setup(admin.id)
  await act(async () => {
    await result.current.update({
      name: 'New Admin',
      loginIdentifier: 'new-admin',
    })
  })
  expect(client.getQueryData(sessionKey)).toEqual({
    ...admin,
    name: 'New Admin',
    loginIdentifier: 'new-admin',
  })
  expect(sessionExpired(client)).toBe(false)
  client.clear()
})

it('changes another account password without signing the administrator out or retaining credentials', async () => {
  apiClient.defaults.adapter = async (config) => ({
    data: account,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  const { client, result } = setup()
  const generation = sessionGeneration(client)
  await act(async () => {
    expect(await result.current.changePassword('pass')).toEqual(account)
  })
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  expect(sessionGeneration(client)).toBe(generation)
  await waitFor(() =>
    expect(client.getMutationCache().getAll()).toHaveLength(0),
  )
  client.clear()
})

it('ends a self-password session locally without logout or authenticated refetch and clears private data', async () => {
  const calls = vi.fn()
  const saved = { ...account, ...admin, activeUnit: null }
  apiClient.defaults.adapter = async (config) => {
    calls(config)
    return { data: saved, status: 200, statusText: 'OK', headers: {}, config }
  }
  const { client, result } = setup(admin.id)
  client.setQueryDefaults(unitsKey, { meta: { requiresAuth: true } })
  client.setQueryData(unitsKey, { old: true })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const feedback = vi.spyOn(toast, 'add')
  const generation = sessionGeneration(client)
  await act(async () => {
    await result.current.changePassword('pass')
  })
  expect(calls).toHaveBeenCalledTimes(1)
  expect(calls.mock.calls[0][0].url).toBe(`/accounts/${admin.id}`)
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(client.getQueryData(unitsKey)).toBeUndefined()
  expect(sessionGeneration(client)).toBeGreaterThan(generation)
  expect(sessionExpired(client)).toBe(false)
  expect(invalidate).not.toHaveBeenCalled()
  expect(feedback).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Password changed', type: 'success' }),
  )
  await waitFor(() =>
    expect(client.getMutationCache().getAll()).toHaveLength(0),
  )
  client.clear()
})

it.each(['unmount', 'session'] as const)(
  'blocks duplicate writes and ignores old-session completion after %s',
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
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    const { client, result, unmount } = setup()
    const feedback = vi.spyOn(toast, 'add')
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    let pending!: ReturnType<typeof result.current.changePassword>
    act(() => {
      pending = result.current.changePassword('pass')
    })
    await waitFor(() => expect(calls).toHaveBeenCalledTimes(1))
    await act(async () => {
      expect(await result.current.activate()).toBeUndefined()
      if (ending === 'unmount') unmount()
      else await expireSession(client)
      finish()
      expect(await pending).toBeUndefined()
    })
    if (ending === 'unmount') expect(signal?.aborted).toBe(true)
    expect(feedback).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    client.clear()
  },
)

it('refreshes affected state on a membership conflict and preserves the backend error', async () => {
  const error = new ApiError(
    'Resolve assigned work before changing this active Technician account',
    'CONFLICT',
    409,
  )
  apiClient.defaults.adapter = async () => {
    throw error
  }
  const { client, result } = setup()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  await act(async () => {
    await expect(result.current.update({ role: 'ADMIN' })).rejects.toBe(error)
  })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: accountsKey })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: unitsKey })
  client.clear()
})
