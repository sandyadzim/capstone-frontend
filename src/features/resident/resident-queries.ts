import { queryOptions } from '@tanstack/react-query'
import { getProperty } from '@/features/admin/settings/settings-api'
import { getResidentUnit } from './resident-api'

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
