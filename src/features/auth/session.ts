import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { CanceledError } from 'axios'
import { ApiError } from '@/lib/api/error'
import { getSession, postLogin, postLogout } from './api'
import type { Actor, LoginValues } from './schema'

export const sessionKey = ['auth', 'session'] as const

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { requiresAuth?: boolean }
    mutationMeta: { requiresAuth?: boolean }
  }
}

// Request generations are transient coordination, not a second copy of server state.
const states = new WeakMap<
  QueryClient,
  {
    generation: number
    expired: boolean
    busy: boolean
    finished?: Promise<void>
    controller?: AbortController
  }
>()
function state(client: QueryClient) {
  let value = states.get(client)
  if (!value) {
    value = { generation: 0, expired: false, busy: false }
    states.set(client, value)
  }
  return value
}
export function sessionGeneration(client: QueryClient) {
  return state(client).generation
}
export function sessionExpired(client: QueryClient) {
  return state(client).expired
}

async function clearPrivateData(client: QueryClient) {
  await client.cancelQueries({
    predicate: (query) => query.meta?.requiresAuth === true,
  })
  client.removeQueries({
    predicate: (query) => query.meta?.requiresAuth === true,
  })
  client.getMutationCache().clear()
}

export async function expireSession(client: QueryClient) {
  const current = state(client)
  if (client.getQueryData(sessionKey) === null && !current.busy) return
  current.generation++
  current.controller?.abort()
  current.expired = true
  // Hide private content immediately, before waiting for cancellation.
  void client.cancelQueries({ queryKey: sessionKey })
  client.setQueryData(sessionKey, null)
  await clearPrivateData(client)
}

export const sessionQueryOptions = (client: QueryClient) =>
  // Each QueryClient owns its cache; client is coordination, not a server-data key.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  queryOptions({
    queryKey: sessionKey,
    staleTime: 60_000,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    queryFn: async ({ signal }) => {
      const current = state(client)
      if (current.busy) await current.finished
      if (signal.aborted) throw new CanceledError()
      const generation = current.generation
      const actor = await getSession(signal)
      if (signal.aborted || generation !== current.generation)
        throw new CanceledError()
      const previous = client.getQueryData<Actor | null>(sessionKey)
      if (
        previous &&
        (previous.id !== actor?.id || previous.role !== actor?.role)
      ) {
        current.generation++
        current.expired = actor === null
        const changedGeneration = current.generation
        await clearPrivateData(client)
        assertCurrent(client, changedGeneration)
      }
      if (signal.aborted) throw new CanceledError()
      return actor
    },
  })

export class SessionVerificationError extends Error {
  constructor(
    message = 'Unable to verify your session. Try checking it again.',
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

async function transition<T>(
  client: QueryClient,
  operation: (generation: number, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const current = state(client)
  if (current.busy)
    throw new CanceledError('An authentication request is already in progress.')
  current.busy = true
  const controller = new AbortController()
  current.controller = controller
  let finish!: () => void
  current.finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  const generation = ++current.generation
  try {
    await client.cancelQueries({ queryKey: sessionKey })
    return await operation(generation, controller.signal)
  } finally {
    current.busy = false
    current.controller = undefined
    finish()
  }
}
function assertCurrent(client: QueryClient, generation: number) {
  if (state(client).generation !== generation)
    throw new CanceledError('The session has changed.')
}

async function confirmSession(
  client: QueryClient,
  generation: number,
  signal: AbortSignal,
): Promise<Actor> {
  let actor: Actor | null
  try {
    actor = await getSession(signal)
  } catch (cause) {
    assertCurrent(client, generation)
    throw new SessionVerificationError(undefined, { cause })
  }
  assertCurrent(client, generation)
  if (!actor)
    throw new SessionVerificationError(
      'Your session could not be established. Check that cookies are enabled, then sign in again.',
    )
  await clearPrivateData(client)
  assertCurrent(client, generation)
  state(client).expired = false
  client.setQueryData(sessionKey, actor)
  return actor
}

export async function verifyLogin(client: QueryClient): Promise<Actor> {
  return transition(client, (generation, signal) =>
    confirmSession(client, generation, signal),
  )
}

export async function signIn(
  client: QueryClient,
  values: LoginValues,
): Promise<Actor> {
  return transition(client, async (generation, signal) => {
    await postLogin(values, signal)
    assertCurrent(client, generation)
    return confirmSession(client, generation, signal)
  })
}

export async function signOut(client: QueryClient): Promise<void> {
  return transition(client, async (generation, signal) => {
    await postLogout(signal)
    assertCurrent(client, generation)
    await clearPrivateData(client)
    assertCurrent(client, generation)
    state(client).expired = false
    client.setQueryData(sessionKey, null)
  })
}

export function authErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 401)
      return 'Your login ID or password is incorrect.'
    if (error.statusCode === 403)
      return 'Sign in is unavailable from this address. Contact your administrator.'
    if (error.statusCode === 400)
      return 'Check your login ID and password, then try again.'
    if (error.statusCode && error.statusCode >= 500)
      return 'The service is temporarily unavailable. Try again.'
  }
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Try again.'
}
