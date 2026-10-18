import { queryOptions } from '@tanstack/react-query'
import { getDashboardSummary, getDashboardTrends } from './dashboard-api'

export const dashboardKey = ['admin', 'dashboard'] as const
export const dashboardSummaryQueryOptions = () =>
  queryOptions({
    queryKey: [...dashboardKey, 'summary'],
    queryFn: ({ signal }) => getDashboardSummary(signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })

export const dashboardTrendsQueryOptions = () =>
  queryOptions({
    queryKey: [...dashboardKey, 'trends', 6],
    queryFn: ({ signal }) => getDashboardTrends(signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
