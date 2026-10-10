import { expect, it } from 'vitest'
import { z } from 'zod'
import {
  paginatedResponseSchema,
  paginationSchema,
} from '@/lib/schemas/pagination'

it('validates a paginated unrelated feature with its own transformed item schema', () => {
  const schema = paginatedResponseSchema(
    z.object({ reading: z.string().transform(Number) }),
  )
  const result = schema.parse({
    data: [{ reading: '42', extra: true }],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  })
  const reading: number = result.data[0].reading
  expect(reading).toBe(42)
  expect(result).toEqual({
    data: [{ reading: 42 }],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  })
})

it('accepts empty-page metadata and rejects invalid counts and page boundaries', () => {
  const empty = { page: 1, pageSize: 20, total: 0, totalPages: 0 }
  expect(paginationSchema.parse(empty)).toEqual(empty)
  for (const invalid of [
    { page: 0 },
    { page: Number.MAX_SAFE_INTEGER + 1 },
    { pageSize: 0 },
    { pageSize: 101 },
    { pageSize: '20' },
    { total: -1 },
    { total: Number.MAX_SAFE_INTEGER + 1 },
    { totalPages: 1.5 },
    { totalPages: Infinity },
  ]) {
    expect(paginationSchema.safeParse({ ...empty, ...invalid }).success).toBe(
      false,
    )
  }
})
