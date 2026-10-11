import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { getReport } from '@/features/admin/reports/report-api'
import { reportStatusSchema } from '@/features/admin/reports/report-schema'
import { apiClient } from '@/lib/api/client'
import { completedReport, reportDetail } from './fixtures'

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

it('reads and validates complete details with credentials and cancellation', async () => {
  const adapter = respond({ ...completedReport, internalField: 'ignored' })
  const signal = new AbortController().signal
  await expect(
    getReport(reportDetail.id.toUpperCase(), signal),
  ).resolves.toEqual(completedReport)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: `/reports/${reportDetail.id}`,
    method: 'get',
    signal,
    withCredentials: true,
  })
})

it.each(reportStatusSchema.options)(
  'accepts %s with nullable and omitted optional fields',
  async (status) => {
    respond({
      ...reportDetail,
      status,
      createdBy: undefined,
      reportedBy: undefined,
      reviewedBy: undefined,
      closedBy: undefined,
      reviewNote: undefined,
      costItems: undefined,
    })
    expect((await getReport(reportDetail.id)).status).toBe(status)
  },
)

it.each([
  null,
  { ...reportDetail, assignment: { ...completedReport.assignment, note: {} } },
  { ...reportDetail, rejectionReason: {} },
  { ...reportDetail, createdBy: { id: 'invalid', name: 'Creator' } },
  {
    ...completedReport,
    maintenanceResult: {
      ...completedReport.maintenanceResult,
      updatedAt: 'bad',
    },
  },
  {
    ...reportDetail,
    damagePhotos: [
      { ...completedReport.damagePhotos[0], fileUrl: 'javascript:alert(1)' },
    ],
  },
  {
    ...reportDetail,
    receipt: { ...completedReport.receipt, fileUrl: '/relative.pdf' },
  },
  {
    ...completedReport,
    costItems: [{ ...completedReport.costItems![0], quantity: '1e3' }],
  },
  { ...reportDetail, totalCost: 100 },
  { ...reportDetail, closedAt: 'invalid' },
])('rejects malformed consumed fields: %j', async (data) => {
  respond(data)
  await expect(getReport(reportDetail.id)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    statusCode: 200,
  })
})

it('rejects a different report ID in the response', async () => {
  respond({ ...reportDetail, id: '55000000-0000-4000-8000-000000000002' })
  await expect(getReport(reportDetail.id)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('rejects invalid IDs and preserves cancellation without requesting', async () => {
  const adapter = respond(reportDetail)
  await expect(getReport('invalid')).rejects.toThrow()
  const controller = new AbortController()
  controller.abort()
  await expect(
    getReport(reportDetail.id, controller.signal),
  ).rejects.toBeInstanceOf(CanceledError)
  expect(adapter).not.toHaveBeenCalled()
})
