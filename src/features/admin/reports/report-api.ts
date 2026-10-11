import {
  reportsControllerList,
  reportsControllerCreate,
  reportsControllerGet,
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
} from './report-schema'
import { z } from 'zod'
import { damagePhotoError } from './report-utils'
import { ApiError } from '@/lib/api/error'

export async function getReport(id: string, signal?: AbortSignal) {
  const reportId = z.uuid().parse(id).toLowerCase()
  const report = parseApiResponse(
    reportDetailSchema,
    await reportsControllerGet(reportId, { signal }),
  )
  if (report.id.toLowerCase() !== reportId)
    throw new ApiError(
      'The server returned a different report.',
      'INVALID_RESPONSE',
      200,
    )
  return report
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
