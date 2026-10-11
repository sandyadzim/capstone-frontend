import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { assignReport } from '@/features/admin/reports/report-api'
import { reportAssignSchema } from '@/features/admin/reports/report-schema'
import { apiClient } from '@/lib/api/client'
import { reportDetail } from './fixtures'

const original = apiClient.defaults.adapter
const technicianUserId = '33000000-0000-4000-8000-000000000003'
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
it('sends only validated assignment fields, trims notes and passes cancellation', async () => {
  const data = { ...reportDetail, status: 'ASSIGNED' }
  const adapter = respond(data)
  const signal = new AbortController().signal
  expect(
    await assignReport(
      reportDetail.id.toUpperCase(),
      { technicianUserId, note: '  Visit unit.  ' },
      signal,
    ),
  ).toEqual(data)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    method: 'post',
    url: `/reports/${reportDetail.id}/assign`,
    signal,
    withCredentials: true,
  })
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    technicianUserId,
    note: 'Visit unit.',
  })
})
it.each([undefined, '', ' \n '])('omits blank note %s', async (note) => {
  const adapter = respond(reportDetail)
  await assignReport(reportDetail.id, { technicianUserId, note })
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    technicianUserId,
  })
})
it('requires a UUID, accepts long notes, and rejects extra wire fields', () => {
  expect(reportAssignSchema.safeParse({}).success).toBe(false)
  expect(
    reportAssignSchema.safeParse({ technicianUserId: 'bad' }).success,
  ).toBe(false)
  expect(
    reportAssignSchema.safeParse({ technicianUserId, note: 'x'.repeat(10000) })
      .success,
  ).toBe(true)
  expect(
    reportAssignSchema.safeParse({ technicianUserId, estimatedArrivalAt: null })
      .success,
  ).toBe(false)
})
it.each([
  { ...reportDetail, assignment: { id: 'bad' } },
  { ...reportDetail, id: '55000000-0000-4000-8000-000000000002' },
])('rejects malformed/mismatched detail', async (data) => {
  respond(data)
  await expect(
    assignReport(reportDetail.id, { technicianUserId }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('does not send an already cancelled request', async () => {
  const adapter = respond(reportDetail)
  const controller = new AbortController()
  controller.abort()
  await expect(
    assignReport(reportDetail.id, { technicianUserId }, controller.signal),
  ).rejects.toBeInstanceOf(CanceledError)
  expect(adapter).not.toHaveBeenCalled()
})
