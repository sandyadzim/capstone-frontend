import { queryOptions } from '@tanstack/react-query'
import { getDashboardSummary } from './dashboard-api'

export const dashboardKey = ['admin', 'dashboard'] as const
export const dashboardSummaryQueryOptions = () =>
  queryOptions({
    queryKey: [...dashboardKey, 'summary'],
    queryFn: ({ signal }) => getDashboardSummary(signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
