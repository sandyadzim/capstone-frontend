import {
  dashboardHistoryControllerSummary,
  dashboardHistoryControllerTrends,
} from '@/lib/api/generated/endpoints'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  dashboardSummarySchema,
  dashboardTrendsSchema,
} from './dashboard-schema'

export async function getDashboardSummary(signal?: AbortSignal) {
  return parseApiResponse(
    dashboardSummarySchema,
    await dashboardHistoryControllerSummary({ signal }),
  )
}

export async function getDashboardTrends(signal?: AbortSignal) {
  return parseApiResponse(
    dashboardTrendsSchema,
    await dashboardHistoryControllerTrends({ months: 6 }, { signal }),
  )
}
