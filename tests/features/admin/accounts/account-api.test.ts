import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import {
  createAccount,
  listAccounts,
} from '@/features/admin/accounts/account-api'
import { apiClient } from '@/lib/api/client'
import { account, accountPage } from './fixtures'

const original = apiClient.defaults.adapter

it('creates through the generated client with a normalized payload, credentials and signal', async () => {
  const adapter = respond({
    ...account,
    activeUnit: null,
    password: 'must be stripped',
  })
  const signal = new AbortController().signal
  const values = {
    name: ' Alex ',
    loginIdentifier: ' USER-ALEX ',
    password: '  password12  ',
    role: 'RESIDENT' as const,
    isActive: false,
  }
  const extendedValues = {
    ...values,
    confirmPassword: values.password,
    unitId: account.activeUnit?.id,
  }
  const response = await createAccount(extendedValues, signal)
  expect(response).toEqual({ ...account, activeUnit: null })
  const config = adapter.mock.calls[0][0]
  expect(config).toMatchObject({
    url: '/accounts',
    method: 'post',
    withCredentials: true,
    signal,
  })
  expect(JSON.parse(config.data)).toEqual({
    ...values,
    name: 'Alex',
    loginIdentifier: 'user-alex',
  })
})

it('does not request invalid creation values and rejects malformed success bodies', async () => {
  const adapter = respond({ id: 'invalid' })
  const values = {
    name: 'Alex',
    loginIdentifier: 'alex',
    password: 'password1234',
    role: 'ADMIN' as const,
    isActive: true,
  }
  await expect(createAccount({ ...values, password: 'bad' })).rejects.toThrow()
  expect(adapter).not.toHaveBeenCalled()
  await expect(createAccount(values)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
afterEach(() => {
  apiClient.defaults.adapter = original
})

function respond(data: unknown) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}

it('forwards account search, role/status, pagination, credentials and cancellation through the generated client', async () => {
  const adapter = respond(accountPage([account]))
  const signal = new AbortController().signal
  const params = {
    q: 'alex%',
    role: 'RESIDENT' as const,
    isActive: 'false' as const,
    page: 2,
    pageSize: 10,
  }
  await expect(listAccounts(params, signal)).resolves.toEqual(
    accountPage([account]),
  )
  expect(adapter.mock.calls[0][0]).toMatchObject({
    method: 'get',
    url: '/accounts',
    params,
    signal,
    withCredentials: true,
  })
  expect(apiClient.getUri(adapter.mock.calls[0][0])).toContain('q=alex%25')
})

it('accepts all roles and statuses with nullable placement and strips undocumented fields', async () => {
  const rows = [
    account,
    { ...account, role: 'ADMIN', isActive: false, activeUnit: null },
    { ...account, role: 'TECHNICIAN', activeUnit: null },
  ]
  respond({
    ...accountPage([]),
    data: rows.map((row) => ({ ...row, passwordHash: 'unexpected' })),
  })
  const result = await listAccounts({})
  expect(result.data).toEqual(rows)
  expect(result.data[0]).not.toHaveProperty('passwordHash')
})

it.each([
  null,
  { data: [account], meta: { page: 0, pageSize: 20, total: 1, totalPages: 1 } },
  accountPage([{ ...account, id: 'invalid' }]),
  accountPage([{ ...account, role: 'OWNER' }]),
  accountPage([{ ...account, isActive: 'true' }]),
  accountPage([{ ...account, loginIdentifier: 'a'.repeat(255) }]),
  accountPage([{ ...account, updatedAt: 'invalid' }]),
  accountPage([
    { ...account, activeUnit: { ...account.activeUnit, floor: 40000 } },
  ]),
])('rejects malformed account responses: %j', async (body) => {
  respond(body)
  await expect(listAccounts({})).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    statusCode: 200,
  })
})

it('preserves cancellation without sending an aborted request', async () => {
  const adapter = respond(accountPage([account]))
  const controller = new AbortController()
  controller.abort()
  await expect(listAccounts({}, controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  expect(adapter).not.toHaveBeenCalled()
})
