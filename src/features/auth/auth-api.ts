import {
  authControllerGetCurrentActor,
  authControllerLogin,
  authControllerLogout,
} from '@/lib/api/generated/endpoints'
import { ApiError } from '@/lib/api/error'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  actorSchema,
  loginSchema,
  type Actor,
  type LoginValues,
} from './auth-schema'

export async function getSession(signal?: AbortSignal): Promise<Actor | null> {
  try {
    const response = await authControllerGetCurrentActor({ signal })
    return parseApiResponse(actorSchema, response)
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
  return parseApiResponse(actorSchema, response)
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
