import { expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError } from '@/lib/api/error'
import { parseApiResponse } from '@/lib/api/parse-response'

it('returns schema output, including transformations and removal of unknown fields', () => {
  const schema = z.object({ count: z.string().transform(Number) })
  const result: { count: number } = parseApiResponse(schema, {
    data: { count: '2', extra: true },
    status: 200,
  })
  expect(result).toEqual({ count: 2 })
})

it('uses a general error message and preserves validation cause and HTTP status', () => {
  const schema = z.object({ count: z.number() })
  let error: unknown
  try {
    parseApiResponse(schema, { data: { count: 'invalid' }, status: 201 })
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({
    code: 'INVALID_RESPONSE',
    statusCode: 201,
    message: 'The API returned an unexpected response. Try again.',
    cause: expect.any(z.ZodError),
  })
})
