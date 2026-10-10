import { accountsControllerList } from '@/lib/api/generated/endpoints'
import type { AccountsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { parseApiResponse } from '@/lib/api/parse-response'
import { accountListSchema } from './account-schema'

export async function listAccounts(
  params: AccountsControllerListParams,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    accountListSchema,
    await accountsControllerList(params, { signal }),
  )
}
