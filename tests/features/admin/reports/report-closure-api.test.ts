import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { closeReport } from '@/features/admin/reports/report-api'
import { apiClient } from '@/lib/api/client'
import { completedReport } from './fixtures'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
function respond(data: unknown) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}
it('posts without a body, validates closure and passes cancellation', async () => {
  const adapter = respond(completedReport)
  const signal = new AbortController().signal
  expect(await closeReport(completedReport.id.toUpperCase(), signal)).toEqual(
    completedReport,
  )
  expect(adapter.mock.calls[0][0]).toMatchObject({
    method: 'post',
    url: `/reports/${completedReport.id}/close`,
    withCredentials: true,
    signal,
  })
  expect(adapter.mock.calls[0][0].data).toBeUndefined()
})
it.each([
  { ...completedReport, id: '55000000-0000-4000-8000-000000000002' },
  { ...completedReport, status: 'COMPLETED' },
  { ...completedReport, closedAt: null },
  { ...completedReport, closedAt: 'bad timestamp' },
  { ...completedReport, closedBy: { id: 'bad', name: 'Admin' } },
  { ...completedReport, maintenanceResult: { inspectionResult: 12 } },
])(
  'rejects a malformed, mismatched or unconfirmed closure response',
  async (data) => {
    respond(data)
    await expect(closeReport(completedReport.id)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  },
)
it('rejects an invalid ID without sending', async () => {
  const adapter = respond(completedReport)
  await expect(closeReport('bad')).rejects.toThrow()
  expect(adapter).not.toHaveBeenCalled()
})
it('preserves cancellation without sending an aborted request', async () => {
  const adapter = respond(completedReport)
  const controller = new AbortController()
  controller.abort()
  await expect(
    closeReport(completedReport.id, controller.signal),
  ).rejects.toBeInstanceOf(CanceledError)
  expect(adapter).not.toHaveBeenCalled()
})
