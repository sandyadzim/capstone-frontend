import { dashboardHistoryControllerSummary } from '@/lib/api/generated/endpoints'
import { parseApiResponse } from '@/lib/api/parse-response'
import { dashboardSummarySchema } from './dashboard-schema'

export async function getDashboardSummary(signal?: AbortSignal) {
  return parseApiResponse(
    dashboardSummarySchema,
    await dashboardHistoryControllerSummary({ signal }),
  )
}
