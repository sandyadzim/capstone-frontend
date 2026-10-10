import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { listAccounts } from '@/features/admin/accounts/account-api'
import { apiClient } from '@/lib/api/client'
import { account, accountPage } from './fixtures'

const original = apiClient.defaults.adapter
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
