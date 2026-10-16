import { z } from 'zod'
import { moneySchema, timestampSchema } from '@/lib/schemas/common'
import {
  paginatedResponseSchema,
  pageSearchSchema,
  pageSizeSearchSchema,
} from '@/lib/schemas/pagination'

const unitNumber = z
  .string()
  .trim()
  .min(1, 'Enter a unit name.')
  .max(40, 'Keep the unit name to 40 characters or fewer.')
const floor = z
  .number()
  .int('Enter a whole-number floor.')
  .min(-32768, 'Enter a floor from −32768 to 32767.')
  .max(32767, 'Enter a floor from −32768 to 32767.')

export const unitDisplayStatusSchema = z.enum([
  'MAINTENANCE',
  'OCCUPIED',
  'VACANT',
])
export const unitSchema = z.object({
  id: z.uuid(),
  propertyId: z.uuid(),
  unitNumber,
  floor,
  maintenanceFlag: z.boolean(),
  isArchived: z.boolean(),
  displayStatus: unitDisplayStatusSchema,
  activeResident: z
    .object({
      id: z.uuid(),
      name: z.string().min(1).max(160),
      loginIdentifier: z.string().min(1).max(254),
    })
    .nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export const unitListSchema = paginatedResponseSchema(unitSchema)
export const unitCreateSchema = z
  .object({ unitNumber, floor, maintenanceFlag: z.boolean().default(false) })
  .strict()
export const unitPatchSchema = unitCreateSchema
  .extend({ maintenanceFlag: z.boolean() })
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one change.',
  )
export const unitFormSchema = z.object({
  unitNumber,
  floor: z
    .string()
    .trim()
    .regex(/^-?\d+$/, 'Enter a whole-number floor.')
    .transform(Number)
    .pipe(floor),
  maintenanceFlag: z.boolean(),
})
export const residentPlacementSchema = z
  .object({ residentUserId: z.uuid('Choose a resident.') })
  .strict()
export const residentAccountSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(160),
  loginIdentifier: z.string().min(1).max(254),
  role: z.literal('RESIDENT'),
  isActive: z.literal(true),
  activeUnit: z.object({ id: z.uuid(), unitNumber, floor }).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export const residentListSchema = paginatedResponseSchema(residentAccountSchema)
export const historyItemSchema = z.object({
  id: z.uuid(),
  reportNumber: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    'AC',
    'ELECTRICAL',
    'PLUMBING',
    'FURNITURE',
    'BUILDING',
    'OTHER',
  ]),
  reportedAt: timestampSchema,
  closedAt: timestampSchema,
  technician: z.object({ id: z.uuid(), name: z.string().min(1) }).nullable(),
  maintenanceResult: z
    .object({
      id: z.uuid(),
      inspectionResult: z.string(),
      problemFound: z.string(),
      repairAction: z.string(),
      additionalNotes: z.string().nullable(),
      createdAt: timestampSchema,
      updatedAt: timestampSchema,
    })
    .nullable(),
  totalCost: moneySchema,
  status: z.literal('CLOSED'),
})
export const historyListSchema = paginatedResponseSchema(historyItemSchema)

const personSchema = z.object({ id: z.uuid(), name: z.string().min(1) })
const photoSchema = z.object({
  id: z.uuid(),
  fileUrl: z.url().refine((url) => /^https?:\/\//i.test(url)),
  createdAt: timestampSchema,
})
export const historyDetailSchema = z.object({
  id: z.uuid(),
  reportNumber: z.string().min(1),
  unit: unitSchema.pick({ id: true, unitNumber: true, floor: true }),
  title: z.string().min(1),
  description: z.string(),
  category: historyItemSchema.shape.category,
  status: z.enum([
    'REPORTED',
    'VERIFIED',
    'REJECTED',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CLOSED',
  ]),
  reportedAt: timestampSchema,
  closedAt: timestampSchema.nullable(),
  maintenanceResult: historyItemSchema.shape.maintenanceResult,
  totalCost: moneySchema,
  assignment: z
    .object({
      id: z.uuid(),
      technician: personSchema.nullable(),
      assignedAt: timestampSchema,
      estimatedArrivalAt: timestampSchema.nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
  reportedBy: personSchema.nullable().optional(),
  closedBy: personSchema.nullable().optional(),
  costItems: z
    .array(
      z.object({
        id: z.uuid(),
        type: z.enum(['SERVICE', 'MATERIAL']),
        description: z.string(),
        price: moneySchema,
      }),
    )
    .optional(),
  damagePhotos: z.array(photoSchema),
  repairPhotos: z.array(photoSchema),
  receipt: photoSchema.nullable(),
})
export type HistoryDetail = z.output<typeof historyDetailSchema>

export const unitsSearchSchema = z.object({
  page: pageSearchSchema.default(1),
  pageSize: pageSizeSearchSchema.default(20),
  q: z.string().max(40).catch('').default(''),
  displayStatus: unitDisplayStatusSchema.nullable().catch(null).default(null),
  isArchived: z.preprocess(
    (value) => (value === 'true' ? true : value === 'false' ? false : value),
    z.boolean().catch(false).default(false),
  ),
  historyPage: pageSearchSchema.default(1),
  historyPageSize: pageSizeSearchSchema.default(20),
})
export type Unit = z.output<typeof unitSchema>
export type UnitCreate = z.output<typeof unitCreateSchema>
export type UnitPatch = z.output<typeof unitPatchSchema>
export type ResidentAccount = z.output<typeof residentAccountSchema>
export type HistoryItem = z.output<typeof historyItemSchema>
export type UnitsSearch = z.output<typeof unitsSearchSchema>
