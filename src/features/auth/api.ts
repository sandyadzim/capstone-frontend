import {
  authControllerGetCurrentActor,
  authControllerLogin,
  authControllerLogout,
} from '@/lib/api/generated/endpoints'
import { ApiError } from '@/lib/api/error'
import {
  actorSchema,
  loginSchema,
  type Actor,
  type LoginValues,
} from './schema'

function parseActor(data: unknown, status: number): Actor {
  const parsed = actorSchema.safeParse(data)
  if (!parsed.success)
    throw new ApiError(
      'The API returned an unexpected account response. Try again.',
      'INVALID_RESPONSE',
      status,
      undefined,
      parsed.error,
    )
  return parsed.data
}

export async function getSession(signal?: AbortSignal): Promise<Actor | null> {
  try {
    const response = await authControllerGetCurrentActor({ signal })
    return parseActor(response.data, response.status)
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) return null
    throw error
  }
}

export async function postLogin(
  values: LoginValues,
  signal?: AbortSignal,
): Promise<Actor> {
  const response = await authControllerLogin(loginSchema.parse(values), {
    signal,
  })
  return parseActor(response.data, response.status)
}

export async function postLogout(signal?: AbortSignal): Promise<void> {
  const response = await authControllerLogout({ signal })
  if (response.status !== 204)
    throw new ApiError(
      'The API did not confirm sign out. Try again.',
      'INVALID_RESPONSE',
      response.status,
    )
}
