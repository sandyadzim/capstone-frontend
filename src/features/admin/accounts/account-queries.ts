import { queryOptions } from '@tanstack/react-query'
import type { AccountsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { listAccounts } from './account-api'

export const accountsKey = ['admin', 'accounts'] as const

export const accountsQueryOptions = (params: AccountsControllerListParams) =>
  queryOptions({
    queryKey: [...accountsKey, 'list', params],
    queryFn: ({ signal }) => listAccounts(params, signal),
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })
