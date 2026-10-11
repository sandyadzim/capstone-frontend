import {
  reportsControllerList,
  reportsControllerCreate,
  reportsControllerGet,
  reportsControllerVerify,
  reportsControllerReject,
  reportsControllerAssign,
  attachmentsControllerUploadDamagePhoto,
} from '@/lib/api/generated/endpoints'
import type { ReportsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  reportListSchema,
  reportCreateSchema,
  createdReportSchema,
  reportPhotoSchema,
  reportDetailSchema,
  type ReportCreate,
  reportVerifySchema,
  reportRejectSchema,
  type ReportVerify,
  type ReportReject,
  reportAssignSchema,
  type ReportAssign,
} from './report-schema'
import { z } from 'zod'
import { damagePhotoError } from './report-utils'
import { ApiError } from '@/lib/api/error'
import type { AxiosResponse } from 'axios'

function parseReport(id: string, response: AxiosResponse) {
  const report = parseApiResponse(reportDetailSchema, response)
  if (report.id.toLowerCase() !== id.toLowerCase())
    throw new ApiError(
      'The server returned a different report.',
      'INVALID_RESPONSE',
      200,
    )
  return report
}

export async function getReport(id: string, signal?: AbortSignal) {
  const reportId = z.uuid().parse(id).toLowerCase()
  return parseReport(reportId, await reportsControllerGet(reportId, { signal }))
}

export async function verifyReport(
  id: string,
  values: ReportVerify,
  signal?: AbortSignal,
) {
  const reportId = z.uuid().parse(id).toLowerCase()
  return parseReport(
    reportId,
    await reportsControllerVerify(reportId, reportVerifySchema.parse(values), {
      signal,
    }),
  )
}

export async function rejectReport(
  id: string,
  values: ReportReject,
  signal?: AbortSignal,
) {
  const reportId = z.uuid().parse(id).toLowerCase()
  return parseReport(
    reportId,
    await reportsControllerReject(reportId, reportRejectSchema.parse(values), {
      signal,
    }),
  )
}

export async function assignReport(
  id: string,
  values: ReportAssign,
  signal?: AbortSignal,
) {
  const reportId = z.uuid().parse(id).toLowerCase()
  return parseReport(
    reportId,
    await reportsControllerAssign(reportId, reportAssignSchema.parse(values), {
      signal,
    }),
  )
}

export async function listReports(
  params: ReportsControllerListParams,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    reportListSchema,
    await reportsControllerList(params, { signal }),
  )
}

export async function createReport(values: ReportCreate, signal?: AbortSignal) {
  return parseApiResponse(
    createdReportSchema,
    await reportsControllerCreate(reportCreateSchema.parse(values), { signal }),
  )
}

export async function uploadDamagePhoto(
  id: string,
  file: File,
  signal?: AbortSignal,
) {
  const issue = damagePhotoError(file)
  if (issue) throw new Error(issue)
  return parseApiResponse(
    reportPhotoSchema,
    await attachmentsControllerUploadDamagePhoto(
      z.uuid().parse(id),
      { file },
      { signal, timeout: 120_000 },
    ),
  )
}
