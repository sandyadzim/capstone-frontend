import {
  accountsControllerCreate,
  accountsControllerList,
  accountsControllerGet,
  accountsControllerUpdate,
  accountsControllerDeactivate,
} from '@/lib/api/generated/endpoints'
import { z } from 'zod'
import type { AxiosResponse } from 'axios'
import { ApiError } from '@/lib/api/error'
import type { AccountsControllerListParams } from '@/lib/api/generated/endpoints.schemas'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  accountCreateSchema,
  accountListSchema,
  accountSchema,
  accountPatchSchema,
  type AccountCreate,
  type AccountPatch,
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

function parseAccount(id: string, response: AxiosResponse) {
  const account = parseApiResponse(accountSchema, response)
  if (account.id.toLowerCase() !== id.toLowerCase())
    throw new ApiError(
      'The server returned an unexpected response.',
      'INVALID_RESPONSE',
      response.status,
    )
  return account
}

export async function getAccount(id: string, signal?: AbortSignal) {
  return parseAccount(
    id,
    await accountsControllerGet(z.uuid().parse(id), { signal }),
  )
}

export async function updateAccount(
  id: string,
  values: AccountPatch,
  signal?: AbortSignal,
) {
  return parseAccount(
    id,
    await accountsControllerUpdate(
      z.uuid().parse(id),
      accountPatchSchema.parse(values),
      { signal },
    ),
  )
}

export async function deactivateAccount(id: string, signal?: AbortSignal) {
  return parseAccount(
    id,
    await accountsControllerDeactivate(z.uuid().parse(id), { signal }),
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
