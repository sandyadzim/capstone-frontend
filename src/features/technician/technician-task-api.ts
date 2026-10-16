import { z } from 'zod'
import { maintenanceExecutionControllerStart } from '@/lib/api/generated/endpoints'
import { parseApiResponse } from '@/lib/api/parse-response'
import { ApiError } from '@/lib/api/error'
import { reportDetailSchema } from '@/features/admin/reports/report-schema'
import { startWorkSchema, type StartWork } from './start-work-schema'

export async function startTask(
  id: string,
  values: StartWork,
  signal?: AbortSignal,
) {
  const reportId = z.uuid().parse(id).toLowerCase()
  const body = startWorkSchema.parse(values)
  const response = await maintenanceExecutionControllerStart(reportId, body, {
    signal,
  })
  const report = parseApiResponse(reportDetailSchema, response)
  if (
    report.id.toLowerCase() !== reportId ||
    report.status !== 'IN_PROGRESS' ||
    !report.assignment?.estimatedArrivalAt ||
    Date.parse(report.assignment.estimatedArrivalAt) !==
      Date.parse(body.estimatedArrivalAt)
  )
    throw new ApiError(
      'The server did not confirm that work started. Refresh the task before trying again.',
      'INVALID_RESPONSE',
      response.status,
    )
  return report
}
