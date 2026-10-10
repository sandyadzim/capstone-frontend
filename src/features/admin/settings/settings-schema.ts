import { z } from 'zod'

export const propertySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(160),
  address: z.string().min(1),
  logoUrl: z.url({ protocol: /^https?$/ }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const propertyDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the property name.')
    .max(160, 'Keep the property name to 160 characters or fewer.'),
  address: z.string().trim().min(1, 'Enter the property address.'),
})
export const propertyPatchSchema = propertyDetailsSchema
  .partial()
  .extend({ logoUrl: z.null().optional() })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one field to update.',
  )
export type Property = z.infer<typeof propertySchema>
export type PropertyDetails = z.infer<typeof propertyDetailsSchema>
export type PropertyPatch = z.infer<typeof propertyPatchSchema>
