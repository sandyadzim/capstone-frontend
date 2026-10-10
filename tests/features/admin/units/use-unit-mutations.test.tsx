// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { apiClient } from '@/lib/api/client'
import { createQueryClient } from '@/app/query-client'
import { expireSession, sessionKey } from '@/features/auth/auth-session'
import { useUnitMutations } from '@/features/admin/units/hooks/use-unit-mutations'
import {
  residentsKey,
  unitDetailKey,
  unitsKey,
} from '@/features/admin/units/unit-queries'
import { toast } from '@/components/ui/toast'
import { admin } from '../settings/fixtures'
import { unit } from './fixtures'

const original = apiClient.defaults.adapter
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
  return { client, ...renderHook(() => useUnitMutations(unit.id), { wrapper }) }
}
it('updates validated detail and invalidates Unit and resident caches', async () => {
  apiClient.defaults.adapter = async (config) => ({
    data: { ...unit, floor: 2 },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  const { result, client } = setup()
  client.setQueryData([...unitsKey, 'list', {}], { old: true })
  client.setQueryData(residentsKey, { old: true })
  await act(() => result.current.update({ floor: 2 }))
  expect(client.getQueryData(unitDetailKey(unit.id))).toMatchObject({
    floor: 2,
  })
  expect(client.getQueryState(residentsKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState([...unitsKey, 'list', {}])?.isInvalidated).toBe(
    true,
  )
  client.clear()
})
it('blocks overlapping writes and ignores an old-session completion', async () => {
  let finish!: () => void
  const gate = new Promise<void>((resolve) => {
    finish = resolve
  })
  const calls = vi.fn()
  apiClient.defaults.adapter = async (config) => {
    calls()
    await gate
    return { data: unit, status: 200, statusText: 'OK', headers: {}, config }
  }
  const { result, client } = setup()
  const feedback = vi.spyOn(toast, 'add')
  let pending!: ReturnType<typeof result.current.archive>
  act(() => {
    pending = result.current.archive()
  })
  await waitFor(() => expect(calls).toHaveBeenCalledTimes(1))
  await act(async () => {
    expect(await result.current.release()).toBeUndefined()
    await expireSession(client)
    finish()
    await pending
  })
  expect(calls).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(unitDetailKey(unit.id))).toBeUndefined()
  expect(feedback).not.toHaveBeenCalled()
  client.clear()
})
it.each(['create', 'update', 'place', 'release', 'archive'] as const)(
  'aborts %s on unmount without feedback or cache updates',
  async (action) => {
    let finish!: () => void
    let signal: AbortSignal | undefined
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    apiClient.defaults.adapter = async (config) => {
      signal = config.signal as AbortSignal
      await gate
      return { data: unit, status: 200, statusText: 'OK', headers: {}, config }
    }
    const { result, client, unmount } = setup()
    const feedback = vi.spyOn(toast, 'add')
    let pending!: Promise<unknown>
    act(() => {
      if (action === 'create')
        pending = result.current.create({
          unitNumber: 'A-101',
          floor: 1,
          maintenanceFlag: false,
        })
      else if (action === 'update')
        pending = result.current.update({ floor: 2 })
      else if (action === 'place')
        pending = result.current.place('33000000-0000-4000-8000-000000000003')
      else pending = result.current[action]()
    })
    await waitFor(() => expect(signal).toBeDefined())
    unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      finish()
      await pending
    })
    expect(feedback).not.toHaveBeenCalled()
    expect(client.getQueryData(unitDetailKey(unit.id))).toBeUndefined()
    client.clear()
  },
)
