import { queryOptions } from '@tanstack/react-query'
import { getProperty } from '@/features/admin/settings/settings-api'
import { getReport, listReports } from '@/features/admin/reports/report-api'

export function technicianTaskDetailQueryOptions(
  actorId: string,
  reportId: string,
) {
  return queryOptions({
    queryKey: ['technician', 'task', actorId, reportId.toLowerCase()],
    queryFn: ({ signal }) => getReport(reportId, signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
}

export function technicianPropertyQueryOptions(actorId: string) {
  return queryOptions({
    queryKey: ['technician', 'property', actorId],
    queryFn: ({ signal }) => getProperty(signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
}

export function technicianTasksQueryOptions(actorId: string) {
  return queryOptions({
    queryKey: ['technician', 'tasks', actorId],
    queryFn: ({ signal }) =>
      listReports({ ongoingOnly: true, page: 1, pageSize: 10 }, signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
}
