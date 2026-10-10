import type { AxiosResponse } from 'axios'
import type { ZodType } from 'zod'
import { ApiError } from './error'

export function parseApiResponse<T>(
  schema: ZodType<T>,
  response: Pick<AxiosResponse<unknown>, 'data' | 'status'>,
): T {
  const parsed = schema.safeParse(response.data)
  if (!parsed.success)
    throw new ApiError(
      'The API returned an unexpected response. Try again.',
      'INVALID_RESPONSE',
      response.status,
      undefined,
      parsed.error,
    )
  return parsed.data
}
