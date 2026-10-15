import { queryOptions } from '@tanstack/react-query'
import { getProperty } from '@/features/admin/settings/settings-api'
import { getResidentUnit } from './resident-api'
import { listReports } from '@/features/admin/reports/report-api'

export const residentReportsKey = ['resident', 'reports'] as const

export function residentReportsQueryOptions(actorId: string, unitId: string) {
  return queryOptions({
    queryKey: [...residentReportsKey, actorId, unitId],
    queryFn: ({ signal }) =>
      listReports({ ongoingOnly: true, page: 1, pageSize: 10 }, signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
}

// Property reads are available to all authenticated roles; admin writes stay separate.
export const residentPropertyQueryOptions = queryOptions({
  queryKey: ['resident', 'property'],
  queryFn: ({ signal }) => getProperty(signal),
  meta: { requiresAuth: true },
  staleTime: 60_000,
  retry: false,
})

export function residentUnitQueryOptions(actorId: string) {
  return queryOptions({
    queryKey: ['resident', 'unit', actorId],
    queryFn: ({ signal }) => getResidentUnit(signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
}
