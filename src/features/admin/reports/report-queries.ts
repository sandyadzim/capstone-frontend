import { queryOptions } from '@tanstack/react-query'
import type { ReportsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { listReports } from './report-api'

export const reportsKey = ['admin', 'reports'] as const

export const reportsQueryOptions = (params: ReportsControllerListParams) =>
  queryOptions({
    queryKey: [...reportsKey, 'list', params],
    queryFn: ({ signal }) => listReports(params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })
