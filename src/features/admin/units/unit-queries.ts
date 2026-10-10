import { queryOptions, useIsMutating, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  getUnit,
  listUnits,
  listResidents,
  listHistory,
  getHistoryDetail,
} from './unit-api'

export const unitsKey = ['admin', 'units'] as const
export const residentsKey = ['admin', 'accounts', 'resident-options'] as const

export const unitDetailKey = (id: string) =>
  [...unitsKey, 'detail', id] as const

export const historyDetailQueryOptions = (unitId: string, reportId: string) =>
  queryOptions({
    queryKey: [...unitsKey, 'history-detail', unitId, reportId],
    queryFn: ({ signal }) => getHistoryDetail(unitId, reportId, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export const unitQueryOptions = (id: string) =>
  queryOptions({
    queryKey: unitDetailKey(id),
    queryFn: ({ signal }) => getUnit(id, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export const unitsQueryOptions = (params: {
  page: number
  pageSize: number
  isArchived: 'true' | 'false'
  displayStatus?: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'
  q?: string
}) =>
  queryOptions({
    queryKey: [...unitsKey, 'list', params],
    queryFn: ({ signal }) => listUnits(params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export const residentsQueryOptions = (params: {
  page: number
  pageSize: number
}) =>
  queryOptions({
    queryKey: [...residentsKey, params],
    queryFn: ({ signal }) => listResidents(params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export const historyQueryOptions = (
  id: string,
  params: { page: number; pageSize: number },
) =>
  queryOptions({
    queryKey: [...unitsKey, 'history', id, params],
    queryFn: ({ signal }) => listHistory(id, params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export function useUnit(id: string) {
  const busy = useIsMutating({ mutationKey: unitsKey }) > 0
  return useQuery({
    ...unitQueryOptions(id),
    enabled: z.uuid().safeParse(id).success && !busy,
  })
}
