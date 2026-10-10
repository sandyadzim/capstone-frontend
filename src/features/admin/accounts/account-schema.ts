import { z } from 'zod'
import { timestampSchema } from '@/lib/schemas/common'
import {
  paginatedResponseSchema,
  pageSearchSchema,
  pageSizeSearchSchema,
} from '@/lib/schemas/pagination'

export const accountRoleSchema = z.enum(['ADMIN', 'TECHNICIAN', 'RESIDENT'])
export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(160),
  loginIdentifier: z.string().min(1).max(254),
  role: accountRoleSchema,
  isActive: z.boolean(),
  activeUnit: z
    .object({
      id: z.uuid(),
      unitNumber: z.string().min(1).max(40),
      floor: z.number().int().min(-32768).max(32767),
    })
    .nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export const accountListSchema = paginatedResponseSchema(accountSchema)

export const accountsSearchSchema = z.object({
  role: accountRoleSchema.optional().catch(undefined),
  q: z.preprocess(
    (value) =>
      typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : value,
    z.string().trim().max(254).catch('').default(''),
  ),
  isActive: z.preprocess(
    (value) => (typeof value === 'boolean' ? String(value) : value),
    z.enum(['true', 'false']).optional().catch(undefined),
  ),
  page: pageSearchSchema.default(1),
  pageSize: pageSizeSearchSchema.default(20),
})

export type Account = z.output<typeof accountSchema>
export type AccountsSearch = z.output<typeof accountsSearchSchema>
