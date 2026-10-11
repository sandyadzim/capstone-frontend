import type { AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import {
  getAccount,
  updateAccount,
  deactivateAccount,
} from '@/features/admin/accounts/account-api'
import {
  accountEditSchema,
  accountPatchSchema,
  accountPasswordSchema,
} from '@/features/admin/accounts/account-schema'
import { changedAccountFields } from '@/features/admin/accounts/account-utils'
import { account } from './fixtures'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})

it('normalizes editable identity and creates a changed-field-only patch', () => {
  const same = accountEditSchema.parse({
    name: ` ${account.name} `,
    loginIdentifier: account.loginIdentifier.toUpperCase(),
    role: account.role,
  })
  expect(changedAccountFields(account, same)).toEqual({})
  const changed = accountEditSchema.parse({
    ...same,
    name: ' New name ',
    role: 'ADMIN',
  })
  expect(changedAccountFields(account, changed)).toEqual({
    name: 'New name',
    role: 'ADMIN',
  })
})

it('rejects empty patches and fields outside account management', () => {
  for (const values of [
    {},
    { name: undefined },
    { unitId: account.activeUnit?.id },
    { confirmPassword: 'pass' },
    { password: 'bad' },
    { password: 'p'.repeat(31) },
  ])
    expect(accountPatchSchema.safeParse(values).success).toBe(false)
  expect(accountPatchSchema.parse({ isActive: true })).toEqual({
    isActive: true,
  })
})

it.each([4, 30])(
  'accepts an exact %i-character password and confirmation without trimming',
  (length) => {
    const password = ` ${'p'.repeat(length - 2)} `
    expect(
      accountPasswordSchema.parse({ password, confirmPassword: password }),
    ).toEqual({ password, confirmPassword: password })
  },
)

it.each([3, 31])('rejects a %i-character new password', (length) => {
  const password = 'p'.repeat(length)
  expect(
    accountPasswordSchema.safeParse({ password, confirmPassword: password })
      .success,
  ).toBe(false)
})

it('requires local password confirmation to match exactly', () => {
  const parsed = accountPasswordSchema.safeParse({
    password: ' pass ',
    confirmPassword: 'pass',
  })
  expect(parsed.success).toBe(false)
  if (!parsed.success)
    expect(parsed.error.issues[0].path).toEqual(['confirmPassword'])
})

it.each(['get', 'update', 'deactivate'] as const)(
  'validates and forwards %s account requests with cancellation and cookie credentials',
  async (kind) => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => ({
      data: { ...account, passwordHash: 'not-public' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    apiClient.defaults.adapter = adapter
    const controller = new AbortController()
    const result =
      kind === 'get'
        ? await getAccount(account.id, controller.signal)
        : kind === 'update'
          ? await updateAccount(
              account.id,
              { loginIdentifier: ' NEW-LOGIN ' },
              controller.signal,
            )
          : await deactivateAccount(account.id, controller.signal)
    expect(result).toEqual(account)
    expect(result).not.toHaveProperty('passwordHash')
    const config = adapter.mock.calls[0][0]
    expect(config.url).toBe(
      `/accounts/${account.id}${kind === 'deactivate' ? '/deactivate' : ''}`,
    )
    expect(config.method).toBe(
      kind === 'update' ? 'patch' : kind === 'deactivate' ? 'post' : 'get',
    )
    expect(config.signal).toBe(controller.signal)
    expect(config.withCredentials).toBe(true)
    if (kind === 'update')
      expect(JSON.parse(config.data)).toEqual({ loginIdentifier: 'new-login' })
  },
)

it.each(['get', 'update', 'deactivate'] as const)(
  'rejects malformed IDs before %s transport',
  async (kind) => {
    const adapter = vi.fn()
    apiClient.defaults.adapter = adapter
    const pending =
      kind === 'get'
        ? getAccount('invalid')
        : kind === 'update'
          ? updateAccount('invalid', { name: 'New' })
          : deactivateAccount('invalid')
    await expect(pending).rejects.toThrow()
    expect(adapter).not.toHaveBeenCalled()
  },
)

it.each(['get', 'update', 'deactivate'] as const)(
  'rejects a different account in the %s response',
  async (kind) => {
    apiClient.defaults.adapter = async (config) => ({
      data: { ...account, id: '33000000-0000-4000-8000-000000000099' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
    const pending =
      kind === 'get'
        ? getAccount(account.id)
        : kind === 'update'
          ? updateAccount(account.id, { name: 'New' })
          : deactivateAccount(account.id)
    await expect(pending).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      statusCode: 200,
    })
  },
)
