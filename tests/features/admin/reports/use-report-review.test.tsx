// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { sessionKey, clearRevokedSession } from '@/features/auth/auth-session'
import { useReportReview } from '@/features/admin/reports/hooks/use-report-review'
import { reportDetailKey } from '@/features/admin/reports/report-queries'
import { reportDetail } from './fixtures'
import { admin } from '../settings/fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: AxiosRequestConfig[]
let hold: Promise<void> | undefined
let failure: ApiError | undefined
beforeEach(() => {
  client = createQueryClient()
  client.setQueryData(sessionKey, admin)
  requests = []
  hold = undefined
  failure = undefined
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    if (hold) await hold
    if (failure) throw failure
    return {
      data: { ...reportDetail, status: 'VERIFIED', finalPriority: 'HIGH' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})
const values = {
  decision: 'verify' as const,
  values: { finalPriority: 'HIGH' as const },
}
function show() {
  return renderHook(() => useReportReview(reportDetail.id), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}
it('cancels reads, updates detail, and invalidates related records', async () => {
  const cancel = vi.spyOn(client, 'cancelQueries')
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = show()
  await act(async () => {
    expect((await result.current.submit(values))?.status).toBe('VERIFIED')
  })
  expect(cancel).toHaveBeenCalledWith({ queryKey: ['admin', 'reports'] })
  expect(client.getQueryData(reportDetailKey(reportDetail.id))).toMatchObject({
    status: 'VERIFIED',
  })
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['admin', 'reports', 'list'],
  })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'units'] })
  expect(result.current.busy).toBe(false)
})
it('locks duplicate submissions and uses authenticated metadata with no retries', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  const { result } = show()
  let work!: ReturnType<typeof result.current.submit>
  act(() => {
    work = result.current.submit(values)
  })
  await waitFor(() => expect(requests).toHaveLength(1))
  expect(result.current.busy).toBe(true)
  const mutation = client.getMutationCache().getAll()[0]
  expect(mutation.options).toMatchObject({
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
  })
  await act(async () => {
    expect(await result.current.submit(values)).toBeUndefined()
    release()
    await work
  })
  expect(requests).toHaveLength(1)
})
it('returns failures once and supports explicit retry', async () => {
  failure = new ApiError('Review failed.', 'NETWORK_ERROR')
  const { result } = show()
  await act(async () => {
    await expect(result.current.submit(values)).rejects.toThrow(
      'Review failed.',
    )
  })
  expect(requests).toHaveLength(1)
  expect(result.current.busy).toBe(false)
  failure = undefined
  await act(async () => {
    await result.current.submit(values)
  })
  expect(requests).toHaveLength(2)
})
it.each(['unmount', 'session'] as const)(
  'ignores a late response after %s',
  async (change) => {
    let release!: () => void
    hold = new Promise((resolve) => {
      release = resolve
    })
    const { result, unmount } = show()
    let work!: ReturnType<typeof result.current.submit>
    act(() => {
      work = result.current.submit(values)
    })
    await waitFor(() => expect(requests).toHaveLength(1))
    if (change === 'session') await act(() => clearRevokedSession(client))
    else unmount()
    if (change === 'unmount') expect(requests[0].signal?.aborted).toBe(true)
    await act(async () => {
      release()
      expect(await work).toBeUndefined()
    })
    expect(
      client.getQueryData(reportDetailKey(reportDetail.id)),
    ).toBeUndefined()
  },
)
it('does not send a write when the session changes while cancelling reads', async () => {
  let release!: () => void
  const cancelled = new Promise<void>((resolve) => {
    release = resolve
  })
  vi.spyOn(client, 'cancelQueries').mockImplementationOnce(() => cancelled)
  const { result } = show()
  let work!: ReturnType<typeof result.current.submit>
  act(() => {
    work = result.current.submit(values)
  })
  await act(() => clearRevokedSession(client))
  await act(async () => {
    release()
    expect(await work).toBeUndefined()
  })
  expect(requests).toHaveLength(0)
})
it('suppresses a late failure after a session change', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  failure = new ApiError('Old account failure', 'HTTP_ERROR', 503)
  const { result } = show()
  let work!: ReturnType<typeof result.current.submit>
  act(() => {
    work = result.current.submit(values)
  })
  await waitFor(() => expect(requests).toHaveLength(1))
  await act(() => clearRevokedSession(client))
  await act(async () => {
    release()
    expect(await work).toBeUndefined()
  })
})
