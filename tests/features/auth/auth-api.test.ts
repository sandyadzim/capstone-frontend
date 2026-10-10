import { afterEach, expect, it, vi } from 'vitest'
import { CanceledError, type AxiosAdapter } from 'axios'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { getSession, postLogin, postLogout } from '@/features/auth/auth-api'
import { loginSchema, type Actor } from '@/features/auth/auth-schema'

const actor: Actor = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test Admin',
  loginIdentifier: 'admin',
  role: 'ADMIN',
}
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
function respond(data: unknown = actor, status = 200) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}

it('validates input, trims the identifier, and preserves every password character', () => {
  expect(
    loginSchema.parse({ loginIdentifier: '  resident  ', password: '  p  ' }),
  ).toEqual({ loginIdentifier: 'resident', password: '  p  ' })
  expect(
    loginSchema.safeParse({ loginIdentifier: ' ', password: '' }).success,
  ).toBe(false)
  expect(
    loginSchema.safeParse({
      loginIdentifier: 'a'.repeat(255),
      password: 'a'.repeat(1025),
    }).success,
  ).toBe(false)
  expect(
    loginSchema.safeParse({
      loginIdentifier: 'a'.repeat(254),
      password: 'a'.repeat(1024),
    }).success,
  ).toBe(true)
})
it('sends only contract fields with shared cookies and forwards the cancellation signal', async () => {
  const adapter = respond({ ...actor, extra: 'discarded' })
  const signal = new AbortController().signal
  await expect(
    postLogin({ loginIdentifier: 'admin', password: ' password ' }, signal),
  ).resolves.toEqual(actor)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: '/auth/login',
    method: 'post',
    signal,
    withCredentials: true,
  })
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    loginIdentifier: 'admin',
    password: ' password ',
  })
  await expect(getSession(signal)).resolves.toEqual(actor)
  expect(adapter.mock.calls[1][0]).toMatchObject({
    url: '/auth/me',
    method: 'get',
    signal,
  })
})
it.each([
  {},
  null,
  { ...actor, id: 'not-a-uuid' },
  { ...actor, role: 'OWNER' },
  { ...actor, name: '' },
  { ...actor, loginIdentifier: '' },
])('rejects a malformed actor %j at the API boundary', async (data) => {
  respond(data)
  await expect(getSession()).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    statusCode: 200,
  })
  await expect(
    postLogin({ loginIdentifier: 'admin', password: 'p' }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('maps only /me 401 to guest, preserving login errors, forbidden, and network failures', async () => {
  const unauthorized = new ApiError('Invalid credentials', 'UNAUTHORIZED', 401)
  apiClient.defaults.adapter = async () => {
    throw unauthorized
  }
  await expect(getSession()).resolves.toBeNull()
  await expect(
    postLogin({ loginIdentifier: 'admin', password: 'wrong' }),
  ).rejects.toBe(unauthorized)
  for (const error of [
    new ApiError('Forbidden', 'FORBIDDEN', 403),
    new ApiError('Offline', 'NETWORK_ERROR'),
    new ApiError('Unavailable', 'HTTP_ERROR', 503),
  ]) {
    apiClient.defaults.adapter = async () => {
      throw error
    }
    await expect(getSession()).rejects.toBe(error)
  }
})
it('accepts only a confirmed logout and respects an already-aborted signal', async () => {
  respond(undefined, 204)
  await expect(postLogout()).resolves.toBeUndefined()
  const adapter = respond()
  await expect(postLogout()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  const controller = new AbortController()
  controller.abort()
  await expect(getSession(controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  expect(adapter).toHaveBeenCalledTimes(1)
})
