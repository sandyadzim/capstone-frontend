import {
  queryOptions,
  useQuery,
  useIsMutating,
  useQueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'
import { sessionKey } from '@/features/auth/auth-session'
import type { AccountsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { getAccount, listAccounts } from './account-api'

export const accountsKey = ['admin', 'accounts'] as const

export const accountDetailKey = (id: string) =>
  [...accountsKey, 'detail', id] as const

export const accountQueryOptions = (id: string) =>
  queryOptions({
    queryKey: accountDetailKey(id),
    queryFn: ({ signal }) => getAccount(id, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })

export function useAccount(id: string) {
  const client = useQueryClient()
  const busy = useIsMutating({ mutationKey: accountsKey }) > 0
  return useQuery({
    ...accountQueryOptions(id),
    enabled: () =>
      z.uuid().safeParse(id).success &&
      !busy &&
      client.getQueryData(sessionKey) != null,
  })
}

export const accountsQueryOptions = (params: AccountsControllerListParams) =>
  queryOptions({
    queryKey: [...accountsKey, 'list', params],
    queryFn: ({ signal }) => listAccounts(params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })
