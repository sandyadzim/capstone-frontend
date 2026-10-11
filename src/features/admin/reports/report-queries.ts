import { queryOptions } from '@tanstack/react-query'
import type { ReportsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { getReport, listReports } from './report-api'

export const reportsKey = ['admin', 'reports'] as const

export const reportDetailKey = (id: string) =>
  [...reportsKey, 'detail', id.toLowerCase()] as const

export const reportDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: reportDetailKey(id),
    queryFn: ({ signal }) => getReport(id, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export const reportsQueryOptions = (params: ReportsControllerListParams) =>
  queryOptions({
    queryKey: [...reportsKey, 'list', params],
    queryFn: ({ signal }) => listReports(params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })
