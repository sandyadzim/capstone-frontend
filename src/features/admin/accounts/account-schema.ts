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

export const accountCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(160, 'Use 160 characters or fewer.'),
  loginIdentifier: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .string()
        .min(1, 'Enter a login ID.')
        .max(254, 'Use 254 characters or fewer.'),
    ),
  password: z
    .string()
    .min(4, 'Use at least 4 characters.')
    .max(30, 'Use 30 characters or fewer.'),
  role: z.enum(accountRoleSchema.options, { error: 'Select a role.' }),
  isActive: z.boolean(),
})

export const accountFormSchema = accountCreateSchema
  .extend({
    confirmPassword: z
      .string()
      .min(1, 'Confirm the password.')
      .max(30, 'Use 30 characters or fewer.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  })

export type AccountCreate = z.output<typeof accountCreateSchema>
export type AccountFormValues = z.output<typeof accountFormSchema>

export const accountEditSchema = accountCreateSchema.pick({
  name: true,
  loginIdentifier: true,
  role: true,
})

export const accountPatchSchema = accountCreateSchema
  .partial()
  .strict()
  .refine(
    (values) => Object.values(values).some((value) => value !== undefined),
    {
      message: 'Provide at least one field to update.',
    },
  )

export const accountPasswordSchema = accountCreateSchema
  .pick({ password: true })
  .extend({ confirmPassword: accountFormSchema.shape.confirmPassword })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  })

export type AccountEdit = z.output<typeof accountEditSchema>
export type AccountPatch = z.output<typeof accountPatchSchema>
export type AccountPassword = z.output<typeof accountPasswordSchema>

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
