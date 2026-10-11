import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { listReports } from '@/features/admin/reports/report-api'
import { reportStatusSchema } from '@/features/admin/reports/report-schema'
import { apiClient } from '@/lib/api/client'
import { report, reportPage } from './fixtures'

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

it('forwards all report filters, credentials and the cancellation signal through the generated client', async () => {
  const adapter = respond(reportPage([report], 2, 10, 11))
  const params = {
    q: 'AC%_\\',
    status: 'REPORTED' as const,
    category: 'AC' as const,
    priority: 'MEDIUM' as const,
    dateFrom: '2026-10-01',
    dateTo: '2026-10-11',
    page: 2,
    pageSize: 10,
  }
  const signal = new AbortController().signal
  await expect(listReports(params, signal)).resolves.toEqual(
    reportPage([report], 2, 10, 11),
  )
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: '/reports',
    method: 'get',
    params,
    signal,
    withCredentials: true,
  })
  expect(apiClient.getUri(adapter.mock.calls[0][0])).toContain('q=AC%25_')
})

it('accepts every status and nullable priorities while stripping undocumented fields', async () => {
  const rows = reportStatusSchema.options.map((status) => ({
    ...report,
    status,
    proposedPriority: null,
    finalPriority: null,
  }))
  respond(reportPage(rows.map((row) => ({ ...row, internal: 'ignored' }))))
  expect((await listReports({})).data).toEqual(rows)
})

it.each([
  null,
  reportPage([{ ...report, id: 'invalid' }]),
  reportPage([{ ...report, unit: { ...report.unit, floor: 40000 } }]),
  reportPage([{ ...report, status: 'OPEN' }]),
  reportPage([{ ...report, category: 'INVALID' }]),
  reportPage([{ ...report, finalPriority: 'URGENT' }]),
  reportPage([{ ...report, proposedPriority: undefined }]),
  reportPage([{ ...report, title: 'a'.repeat(161) }]),
  reportPage([{ ...report, reportedAt: 'invalid' }]),
  { data: [report], meta: { page: 0, pageSize: 20, total: 1, totalPages: 1 } },
])('rejects a malformed success body: %j', async (body) => {
  respond(body)
  await expect(listReports({})).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    statusCode: 200,
  })
})

it('preserves cancellation without sending an already aborted request', async () => {
  const adapter = respond(reportPage([report]))
  const controller = new AbortController()
  controller.abort()
  await expect(listReports({}, controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  expect(adapter).not.toHaveBeenCalled()
})
