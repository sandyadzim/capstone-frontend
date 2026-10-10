import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CanceledError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import {
  expireSession,
  sessionExpired,
  sessionKey,
  sessionQueryOptions,
  signIn,
  signOut,
  verifyLogin,
} from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'

const admin: Actor = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Admin',
  loginIdentifier: 'admin',
  role: 'ADMIN',
}
const resident: Actor = {
  ...admin,
  id: '00000000-0000-4000-8000-000000000002',
  role: 'RESIDENT',
}
const values = { loginIdentifier: 'admin', password: 'password' }
const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
beforeEach(() => {
  client = createQueryClient()
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})
function respond(data: Actor | undefined = admin) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status: config.url === '/auth/logout' ? 204 : 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}
function privateData() {
  client.setQueryDefaults(['reports'], { meta: { requiresAuth: true } })
  client.setQueryData(['reports'], ['old-account-report'])
  client.setQueryData(['health'], { status: 'ok' })
}
it('verifies cookies before storing the actor, clearing private data but preserving public data', async () => {
  const adapter = respond()
  client.setQueryData(sessionKey, null)
  privateData()
  await expect(signIn(client, values)).resolves.toEqual(admin)
  expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
    '/auth/login',
    '/auth/me',
  ])
  expect(
    adapter.mock.calls.every(
      ([config]) => config.signal instanceof AbortSignal,
    ),
  ).toBe(true)
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  expect(client.getQueryData(['reports'])).toBeUndefined()
  expect(client.getQueryData(['health'])).toEqual({ status: 'ok' })
})
it('keeps failed credential submissions as guest and does not verify them', async () => {
  client.setQueryData(sessionKey, null)
  const adapter = vi.fn<AxiosAdapter>(async () => {
    throw new ApiError('Bad password', 'UNAUTHORIZED', 401)
  })
  apiClient.defaults.adapter = adapter
  await expect(signIn(client, values)).rejects.toMatchObject({
    statusCode: 401,
  })
  expect(adapter).toHaveBeenCalledOnce()
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(sessionExpired(client)).toBe(false)
})
it('retries /me without another login when cookie verification fails transiently', async () => {
  let failed = false
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (config.url === '/auth/me' && !failed) {
      failed = true
      throw new ApiError('Offline', 'NETWORK_ERROR')
    }
    return { data: admin, status: 200, statusText: 'OK', headers: {}, config }
  })
  apiClient.defaults.adapter = adapter
  client.setQueryData(sessionKey, null)
  await expect(signIn(client, values)).rejects.toMatchObject({
    message: 'Unable to verify your session. Try checking it again.',
  })
  expect(client.getQueryData(sessionKey)).toBeNull()
  await expect(verifyLogin(client)).resolves.toEqual(admin)
  expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
    '/auth/login',
    '/auth/me',
    '/auth/me',
  ])
})
it('does not enter a portal if the browser did not retain the session cookie', async () => {
  respond()
  const adapter = apiClient.defaults.adapter
  if (typeof adapter !== 'function') throw new Error('Missing adapter')
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/auth/me')
      throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
    return adapter(config)
  }
  await expect(signIn(client, values)).rejects.toMatchObject({
    message: expect.stringContaining('cookies are enabled'),
  })
  await expect(verifyLogin(client)).rejects.toMatchObject({
    message: expect.stringContaining('cookies are enabled'),
  })
  expect(client.getQueryData(sessionKey)).toBeUndefined()
})
it('retains the session and private data after failed logout, then clears both after confirmation', async () => {
  client.setQueryData(sessionKey, admin)
  privateData()
  apiClient.defaults.adapter = async () => {
    throw new ApiError('Offline', 'NETWORK_ERROR')
  }
  await expect(signOut(client)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  expect(client.getQueryData(['reports'])).toBeDefined()
  respond()
  await signOut(client)
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(client.getQueryData(['reports'])).toBeUndefined()
  expect(sessionExpired(client)).toBe(false)
})
it.each([null, resident, { ...admin, role: 'TECHNICIAN' as const }])(
  'reconciles expiration and account/role changes from a fresh /me: %j',
  async (actor) => {
    client.setQueryData(sessionKey, admin)
    privateData()
    if (actor) respond(actor)
    else
      apiClient.defaults.adapter = async () => {
        throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
      }
    await client.fetchQuery({ ...sessionQueryOptions(client), staleTime: 0 })
    expect(client.getQueryData(sessionKey)).toEqual(actor)
    expect(client.getQueryData(['reports'])).toBeUndefined()
    expect(sessionExpired(client)).toBe(actor === null)
  },
)
it('does not retry failed /me checks or mistake network errors for guest', async () => {
  client.setQueryData(sessionKey, admin)
  const adapter = vi.fn<AxiosAdapter>(async () => {
    throw new ApiError('Offline', 'NETWORK_ERROR')
  })
  apiClient.defaults.adapter = adapter
  await expect(
    client.fetchQuery({ ...sessionQueryOptions(client), staleTime: 0 }),
  ).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  expect(adapter).toHaveBeenCalledOnce()
  expect(client.getQueryData(sessionKey)).toEqual(admin)
})
it('cancels a late /me response when logout starts so it cannot restore the old actor', async () => {
  client.setQueryData(sessionKey, admin)
  let resolveMe: (() => void) | undefined
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/auth/me')
      return new Promise<AxiosResponse>((resolve) => {
        resolveMe = () =>
          resolve({
            data: admin,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          })
      })
    return {
      data: undefined,
      status: 204,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  const reading = client
    .fetchQuery({ ...sessionQueryOptions(client), staleTime: 0 })
    .catch(() => undefined)
  await vi.waitFor(() => expect(resolveMe).toBeDefined())
  await signOut(client)
  // Axios notices the aborted signal even if an adapter ignores cancellation.
  if (!resolveMe) throw new Error('Missing pending request')
  resolveMe()
  await reading
  expect(client.getQueryData(sessionKey)).toBeNull()
})
it('prevents duplicate auth transitions and ignores login completion after forced expiration', async () => {
  client.setQueryData(sessionKey, admin)
  let finish: (() => void) | undefined
  apiClient.defaults.adapter = (config) =>
    new Promise<AxiosResponse>((resolve) => {
      finish = () =>
        resolve({
          data: admin,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        })
    })
  const login = signIn(client, values)
  await vi.waitFor(() => expect(finish).toBeDefined())
  await expect(signIn(client, values)).rejects.toBeInstanceOf(CanceledError)
  await expireSession(client)
  if (!finish) throw new Error('Missing login request')
  finish()
  await expect(login).rejects.toBeInstanceOf(CanceledError)
  expect(client.getQueryData(sessionKey)).toBeNull()
  await expireSession(client)
  expect(sessionExpired(client)).toBe(true)
})
it('expires private query/mutation 401, but ignores public 401, forbidden, and an old account mutation', async () => {
  const unauthorized = new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
  client.setQueryData(sessionKey, admin)
  await expect(
    client.fetchQuery({
      queryKey: ['public'],
      retry: false,
      queryFn: async () => {
        throw unauthorized
      },
    }),
  ).rejects.toBe(unauthorized)
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  await expect(
    client.fetchQuery({
      queryKey: ['forbidden'],
      retry: false,
      meta: { requiresAuth: true },
      queryFn: async () => {
        throw new ApiError('Forbidden', 'FORBIDDEN', 403)
      },
    }),
  ).rejects.toMatchObject({ statusCode: 403 })
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  privateData()
  await expect(
    client.fetchQuery({
      queryKey: ['private'],
      meta: { requiresAuth: true },
      queryFn: async () => {
        throw unauthorized
      },
    }),
  ).rejects.toBe(unauthorized)
  await vi.waitFor(() =>
    expect(client.getQueryData(['reports'])).toBeUndefined(),
  )
  expect(client.getQueryData(sessionKey)).toBeNull()
  client.setQueryData(sessionKey, admin)
  const mutation = client.getMutationCache().build(client, {
    meta: { requiresAuth: true },
    mutationFn: async () => {
      throw unauthorized
    },
  })
  await expect(mutation.execute(undefined)).rejects.toBe(unauthorized)
  expect(client.getQueryData(sessionKey)).toBeNull()
  client.setQueryData(sessionKey, admin)
  let rejectOld: ((error: unknown) => void) | undefined
  const old = client.getMutationCache().build(client, {
    meta: { requiresAuth: true },
    mutationFn: () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject
      }),
  })
  const pending = old.execute(undefined).catch(() => undefined)
  await vi.waitFor(() => expect(rejectOld).toBeDefined())
  respond(resident)
  await signIn(client, values)
  rejectOld?.(unauthorized)
  await pending
  expect(client.getQueryData(sessionKey)).toEqual(resident)
})
it('ignores an old private query 401 while a new login is still being verified', async () => {
  client.setQueryData(sessionKey, admin)
  let rejectPrivate: ((error: unknown) => void) | undefined
  const oldReading = client
    .fetchQuery({
      queryKey: ['old-private'],
      meta: { requiresAuth: true },
      queryFn: () =>
        new Promise((_resolve, reject) => {
          rejectPrivate = reject
        }),
    })
    .catch(() => undefined)
  await vi.waitFor(() => expect(rejectPrivate).toBeDefined())
  let finishLogin: (() => void) | undefined
  apiClient.defaults.adapter = (config) => {
    const response = {
      data: resident,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
    if (config.url === '/auth/login')
      return new Promise<AxiosResponse>((resolve) => {
        finishLogin = () => resolve(response)
      })
    return Promise.resolve(response)
  }
  const login = signIn(client, values)
  await vi.waitFor(() => expect(finishLogin).toBeDefined())
  rejectPrivate?.(new ApiError('Unauthorized', 'UNAUTHORIZED', 401))
  await oldReading
  expect(sessionExpired(client)).toBe(false)
  finishLogin?.()
  await expect(login).resolves.toEqual(resident)
  expect(client.getQueryData(sessionKey)).toEqual(resident)
})
