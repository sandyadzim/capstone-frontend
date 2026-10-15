// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { sessionKey, clearRevokedSession } from '@/features/auth/auth-session'
import { useCreateReport } from '@/features/admin/reports/hooks/use-create-report'
import { createdReport, photo, reportCreate } from './fixtures'
import { admin } from '../settings/fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: AxiosRequestConfig[]
let uploadError: ApiError | undefined
let createError: ApiError | undefined
let savedPhotos: (typeof photo)[]
let hold: Promise<void> | undefined
const files = [
  new File(['first'], 'first.png', { type: 'image/png' }),
  new File(['second'], 'second.png', { type: 'image/png' }),
]
beforeEach(() => {
  client = createQueryClient()
  client.setQueryData(sessionKey, admin)
  requests = []
  savedPhotos = []
  uploadError = undefined
  createError = undefined
  hold = undefined
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    if (hold) await hold
    let data: unknown
    if (config.url === '/reports') {
      if (createError) throw createError
      data = createdReport
    } else {
      if (uploadError) throw uploadError
      data = {
        ...photo,
        id: `77000000-0000-4000-8000-${String(savedPhotos.length + 1).padStart(12, '0')}`,
      }
      savedPhotos.push(data as typeof photo)
    }
    return { data, status: 201, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})
function show() {
  return renderHook(() => useCreateReport(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}
it('creates once and uploads sequentially, refreshing reports and units', async () => {
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = show()
  await act(async () => {
    expect(await result.current.create(reportCreate, files)).toBe(true)
  })
  expect(requests.map((r) => r.url)).toEqual([
    '/reports',
    `/reports/${createdReport.id}/damage-photos`,
    `/reports/${createdReport.id}/damage-photos`,
  ])
  expect(result.current.report?.id).toBe(createdReport.id)
  expect(result.current.uploadError).toBeUndefined()
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'reports'] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'units'] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['resident', 'reports'] })
  await act(async () => {
    expect(await result.current.create(reportCreate, files)).toBe(false)
  })
  expect(requests).toHaveLength(3)
})
it('accepts no photos and suppresses duplicate clicks while creation is pending', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  const { result } = show()
  let first!: Promise<boolean>
  act(() => {
    first = result.current.create(reportCreate, [])
  })
  await waitFor(() => expect(requests).toHaveLength(1))
  expect(result.current.busy).toBe(true)
  await act(async () => {
    expect(await result.current.create(reportCreate, [])).toBe(false)
    release()
    expect(await first).toBe(true)
  })
  expect(requests).toHaveLength(1)
})
it('stops on an upload error and keeps the created report without retrying', async () => {
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = show()
  const base = apiClient.defaults.adapter
  let upload = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/damage-photos') && ++upload === 2) {
      requests.push(config)
      throw new ApiError('Rejected file', 'VALIDATION_ERROR', 400)
    }
    if (typeof base !== 'function') throw new Error('Missing adapter')
    return base(config)
  }
  await act(async () => {
    expect(
      await result.current.create(reportCreate, [...files, files[0]]),
    ).toBe(false)
  })
  expect(result.current.report?.id).toBe(createdReport.id)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['resident', 'reports'] })
  expect(result.current.uploadError).toContain(
    'was created, but photo upload failed. Rejected file',
  )
  expect(result.current.busy).toBe(false)
  expect(savedPhotos).toHaveLength(1)
  expect(requests).toHaveLength(3)
  await act(async () => {
    expect(await result.current.create(reportCreate, files)).toBe(false)
  })
  expect(requests).toHaveLength(3)
})
it('aborts on unmount and suppresses a late success after session cleanup', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  const { result, unmount } = show()
  let work!: Promise<boolean>
  act(() => {
    work = result.current.create(reportCreate, files)
  })
  await waitFor(() => expect(requests).toHaveLength(1))
  await act(() => clearRevokedSession(client))
  unmount()
  expect(requests[0].signal?.aborted).toBe(true)
  release()
  expect(await work).toBe(false)
  expect(requests).toHaveLength(1)
  expect(client.getQueryData(sessionKey)).toBeNull()
})
