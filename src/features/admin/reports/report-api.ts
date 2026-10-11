import { reportsControllerList } from '@/lib/api/generated/endpoints'
import type { ReportsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { parseApiResponse } from '@/lib/api/parse-response'
import { reportListSchema } from './report-schema'

export async function listReports(
  params: ReportsControllerListParams,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    reportListSchema,
    await reportsControllerList(params, { signal }),
  )
}
