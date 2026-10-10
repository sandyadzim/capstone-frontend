import { z } from 'zod'

export const paginationPageSizes = [10, 20, 50, 100] as const

export const paginationSchema = z.object({
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  totalPages: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})
export type PaginationMeta = z.output<typeof paginationSchema>

export function paginatedResponseSchema<T>(itemSchema: z.ZodType<T>) {
  return z.object({ data: z.array(itemSchema), meta: paginationSchema })
}

export const pageSearchSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Math.floor(Number.MAX_SAFE_INTEGER / 100))
  .catch(1)

export const pageSizeSearchSchema = z.coerce
  .number()
  .refine((value) => paginationPageSizes.some((size) => size === value))
  .catch(20)
