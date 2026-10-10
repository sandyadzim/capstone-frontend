import {
  accountsControllerCreate,
  accountsControllerList,
} from '@/lib/api/generated/endpoints'
import type { AccountsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  accountCreateSchema,
  accountListSchema,
  accountSchema,
  type AccountCreate,
} from './account-schema'

export async function createAccount(
  values: AccountCreate,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    accountSchema,
    await accountsControllerCreate(accountCreateSchema.parse(values), {
      signal,
    }),
  )
}

export async function listAccounts(
  params: AccountsControllerListParams,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    accountListSchema,
    await accountsControllerList(params, { signal }),
  )
}
