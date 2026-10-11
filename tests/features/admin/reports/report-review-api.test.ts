import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { verifyReport, rejectReport } from '@/features/admin/reports/report-api'
import {
  reportVerifySchema,
  reportRejectSchema,
} from '@/features/admin/reports/report-schema'
import { apiClient } from '@/lib/api/client'
import { reportDetail } from './fixtures'

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
it.each(['verify', 'reject'] as const)(
  'posts a validated %s request and validates detail',
  async (decision) => {
    const data = {
      ...reportDetail,
      status: decision === 'verify' ? 'VERIFIED' : 'REJECTED',
      finalPriority: 'HIGH',
      reviewNote: 'Internal',
      rejectionReason: decision === 'reject' ? 'Duplicate' : null,
    }
    const adapter = respond(data)
    const signal = new AbortController().signal
    const result =
      decision === 'verify'
        ? await verifyReport(
            reportDetail.id.toUpperCase(),
            { finalPriority: 'HIGH', reviewNote: ' Internal ' },
            signal,
          )
        : await rejectReport(
            reportDetail.id.toUpperCase(),
            {
              finalPriority: 'HIGH',
              reviewNote: ' Internal ',
              rejectionReason: ' Duplicate ',
            },
            signal,
          )
    expect(result).toEqual(data)
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: 'post',
      url: `/reports/${reportDetail.id}/${decision}`,
      signal,
      withCredentials: true,
    })
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
      finalPriority: 'HIGH',
      reviewNote: 'Internal',
      ...(decision === 'reject' ? { rejectionReason: 'Duplicate' } : {}),
    })
  },
)
it.each(['verify', 'reject'] as const)(
  'omits a blank optional note for %s',
  async (decision) => {
    const adapter = respond(reportDetail)
    if (decision === 'verify')
      await verifyReport(reportDetail.id, {
        finalPriority: 'LOW',
        reviewNote: ' \n ',
      })
    else
      await rejectReport(reportDetail.id, {
        finalPriority: 'LOW',
        rejectionReason: 'Duplicate',
        reviewNote: ' \n ',
      })
    expect(JSON.parse(adapter.mock.calls[0][0].data)).not.toHaveProperty(
      'reviewNote',
    )
  },
)
it('requires priority and a trimmed reason, rejecting unknown wire fields', () => {
  expect(reportVerifySchema.safeParse({}).success).toBe(false)
  expect(
    reportRejectSchema.safeParse({
      finalPriority: 'LOW',
      rejectionReason: ' \n ',
    }).success,
  ).toBe(false)
  expect(
    reportVerifySchema.safeParse({ finalPriority: 'URGENT' }).success,
  ).toBe(false)
  expect(
    reportVerifySchema.safeParse({ finalPriority: 'LOW', status: 'VERIFIED' })
      .success,
  ).toBe(false)
  expect(
    reportRejectSchema.safeParse({
      finalPriority: 'LOW',
      rejectionReason: 'Valid',
      reviewedByUserId: reportDetail.id,
    }).success,
  ).toBe(false)
})
it.each(['verify', 'reject'] as const)(
  'rejects malformed or mismatched %s responses',
  async (decision) => {
    const write = () =>
      decision === 'verify'
        ? verifyReport(reportDetail.id, { finalPriority: 'LOW' })
        : rejectReport(reportDetail.id, {
            finalPriority: 'LOW',
            rejectionReason: 'Duplicate',
          })
    respond({ ...reportDetail, reviewedBy: { id: 'bad', name: 'Admin' } })
    await expect(write()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    respond({ ...reportDetail, id: '55000000-0000-4000-8000-000000000002' })
    await expect(write()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  },
)
it.each(['verify', 'reject'] as const)(
  'preserves %s cancellation without sending',
  async (decision) => {
    const adapter = respond(reportDetail)
    const controller = new AbortController()
    controller.abort()
    const write =
      decision === 'verify'
        ? verifyReport(
            reportDetail.id,
            { finalPriority: 'LOW' },
            controller.signal,
          )
        : rejectReport(
            reportDetail.id,
            { finalPriority: 'LOW', rejectionReason: 'Duplicate' },
            controller.signal,
          )
    await expect(write).rejects.toBeInstanceOf(CanceledError)
    expect(adapter).not.toHaveBeenCalled()
  },
)
