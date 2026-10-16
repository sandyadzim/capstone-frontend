import { z } from 'zod'
import {
  maintenanceExecutionControllerSaveResult,
  maintenanceExecutionControllerSaveCostItems,
  maintenanceExecutionControllerComplete,
  attachmentsControllerUploadRepairPhoto,
  attachmentsControllerUploadReceipt,
} from '@/lib/api/generated/endpoints'
import { parseApiResponse } from '@/lib/api/parse-response'
import { ApiError } from '@/lib/api/error'
import { reportPhotoSchema } from '@/features/admin/reports/report-schema'
import { imageFileError } from '@/lib/image-file'
import {
  completionFormSchema,
  completionReportSchema,
  receiptFileError,
  type CompletionValues,
} from './completion-schema'
import type { AxiosResponse } from 'axios'

function parseTask(
  id: string,
  response: AxiosResponse,
  status: 'IN_PROGRESS' | 'COMPLETED',
) {
  const report = parseApiResponse(completionReportSchema, response)
  if (report.id.toLowerCase() !== id.toLowerCase() || report.status !== status)
    throw new ApiError(
      'The server did not confirm the task update.',
      'INVALID_RESPONSE',
      response.status,
    )
  return report
}
export async function saveWorkResult(
  id: string,
  values: CompletionValues,
  signal: AbortSignal,
) {
  const { inspectionResult, problemFound, repairAction, additionalNotes } =
    completionFormSchema.parse(values)
  return parseTask(
    id,
    await maintenanceExecutionControllerSaveResult(
      z.uuid().parse(id),
      {
        inspectionResult,
        problemFound,
        repairAction,
        additionalNotes: additionalNotes || null,
      },
      { signal },
    ),
    'IN_PROGRESS',
  )
}
export async function saveWorkCosts(
  id: string,
  values: CompletionValues,
  signal: AbortSignal,
) {
  const { items } = completionFormSchema.parse(values)
  return parseTask(
    id,
    await maintenanceExecutionControllerSaveCostItems(
      z.uuid().parse(id),
      { items },
      { signal },
    ),
    'IN_PROGRESS',
  )
}
export async function uploadRepairPhoto(
  id: string,
  file: File,
  signal: AbortSignal,
) {
  const error = imageFileError(file, 5)
  if (error) throw new Error(error)
  return parseApiResponse(
    reportPhotoSchema,
    await attachmentsControllerUploadRepairPhoto(
      z.uuid().parse(id),
      { file },
      { signal, timeout: 120_000 },
    ),
  )
}
export async function uploadReceipt(
  id: string,
  file: File,
  signal: AbortSignal,
) {
  const error = receiptFileError(file)
  if (error) throw new Error(error)
  return parseApiResponse(
    reportPhotoSchema,
    await attachmentsControllerUploadReceipt(
      z.uuid().parse(id),
      { file },
      { signal, timeout: 120_000 },
    ),
  )
}
export async function completeTask(id: string, signal: AbortSignal) {
  const report = parseTask(
    id,
    await maintenanceExecutionControllerComplete(
      z.uuid().parse(id),
      undefined,
      { signal },
    ),
    'COMPLETED',
  )
  if (!report.maintenanceResult || !report.receipt)
    throw new ApiError(
      'The server returned incomplete work information.',
      'INVALID_RESPONSE',
      200,
    )
  return report
}
