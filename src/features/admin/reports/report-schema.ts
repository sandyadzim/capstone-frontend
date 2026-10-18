import { z } from 'zod'
import {
  calendarDateSchema,
  moneySchema,
  timestampSchema,
} from '@/lib/schemas/common'
import {
  paginatedResponseSchema,
  pageSearchSchema,
  pageSizeSearchSchema,
} from '@/lib/schemas/pagination'

export const reportStatusSchema = z.enum([
  'REPORTED',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
])
export const reportCategorySchema = z.enum([
  'AC',
  'ELECTRICAL',
  'PLUMBING',
  'FURNITURE',
  'BUILDING',
  'OTHER',
])
export const reportPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export const reportSortSchema = z.enum(['latest', 'priority'])
export type ReportSort = z.output<typeof reportSortSchema>

const optionalReportNoteSchema = z.preprocess(
  (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
  z.string().trim().min(1).optional(),
)
export const reportAssignSchema = z
  .object({
    technicianUserId: z.uuid('Choose a technician.').toLowerCase(),
    note: optionalReportNoteSchema,
  })
  .strict()
export const reportAssignmentFormSchema = z.object({
  technicianUserId: z.uuid('Choose a technician.'),
  note: z.string(),
})
export type ReportAssign = z.output<typeof reportAssignSchema>
export type ReportAssignmentForm = z.input<typeof reportAssignmentFormSchema>

export const reportVerifySchema = z
  .object({
    finalPriority: reportPrioritySchema,
    reviewNote: optionalReportNoteSchema,
  })
  .strict()
export const reportRejectSchema = reportVerifySchema.extend({
  rejectionReason: z.string().trim().min(1, 'Enter a rejection reason.'),
})
export const reportReviewFormSchema = z.object({
  finalPriority: reportPrioritySchema
    .optional()
    .refine((value) => value !== undefined, 'Choose a final priority.'),
  reviewNote: z.string(),
  rejectionReason: z.string(),
})
export const reportRejectFormSchema = reportReviewFormSchema.extend({
  rejectionReason: z.string().trim().min(1, 'Enter a rejection reason.'),
})
export type ReportVerify = z.output<typeof reportVerifySchema>
export type ReportReject = z.output<typeof reportRejectSchema>
export type ReportReviewForm = z.input<typeof reportRejectFormSchema>

export const reportListItemSchema = z.object({
  id: z.uuid(),
  reportNumber: z.string().min(1),
  unit: z.object({
    id: z.uuid(),
    unitNumber: z.string().min(1).max(40),
    floor: z.number().int().min(-32768).max(32767),
  }),
  title: z.string().min(1).max(160),
  category: reportCategorySchema,
  proposedPriority: reportPrioritySchema.nullable(),
  finalPriority: reportPrioritySchema.nullable(),
  status: reportStatusSchema,
  reportedAt: timestampSchema,
})
export const reportListSchema = paginatedResponseSchema(reportListItemSchema)

export const reportCreateSchema = z
  .object({
    unitId: z.uuid('Choose a unit.').toLowerCase(),
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title.')
      .max(160, 'Keep the title to 160 characters or fewer.'),
    description: z.string().trim().min(1, 'Enter a description.'),
    category: reportCategorySchema,
    priority: reportPrioritySchema,
  })
  .strict()

export const reportFormSchema = reportCreateSchema.extend({
  category: reportCategorySchema
    .optional()
    .refine((value) => value !== undefined, 'Choose a category.'),
  priority: reportPrioritySchema
    .optional()
    .refine((value) => value !== undefined, 'Choose a priority.'),
})

export const reportPhotoSchema = z.object({
  id: z.uuid(),
  fileUrl: z.url().refine((url) => /^https?:\/\//i.test(url)),
  createdAt: timestampSchema,
})

// Validate the creation/recovery fields this page consumes, rather than coupling
// creation to the later assignment, costs, and work-result screens.
export const createdReportSchema = reportListItemSchema.extend({
  description: z.string().min(1),
  damagePhotos: z.array(reportPhotoSchema).max(5),
})

export type ReportCreate = z.output<typeof reportCreateSchema>
export type ReportFormValues = z.input<typeof reportFormSchema>
export type CreatedReport = z.output<typeof createdReportSchema>
export type ReportPhoto = z.output<typeof reportPhotoSchema>

const reportPersonSchema = z.object({ id: z.uuid(), name: z.string().min(1) })
export const reportDetailSchema = reportListItemSchema.extend({
  description: z.string(),
  rejectionReason: z.string().nullable(),
  reviewNote: z.string().nullable().optional(),
  reportedBy: reportPersonSchema.nullable().optional(),
  createdBy: reportPersonSchema.nullable().optional(),
  reviewedBy: reportPersonSchema.nullable().optional(),
  closedBy: reportPersonSchema.nullable().optional(),
  closedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  assignment: z
    .object({
      id: z.uuid(),
      technician: reportPersonSchema.nullable(),
      assignedBy: reportPersonSchema.nullable().optional(),
      assignedAt: timestampSchema,
      estimatedArrivalAt: timestampSchema.nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
  damagePhotos: z.array(reportPhotoSchema).max(5),
  repairPhotos: z.array(reportPhotoSchema).max(5),
  receipt: reportPhotoSchema.nullable(),
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
  costItems: z
    .array(
      z.object({
        id: z.uuid(),
        type: z.enum(['SERVICE', 'MATERIAL']),
        description: z.string(),
        price: moneySchema,
        createdAt: timestampSchema,
        updatedAt: timestampSchema,
      }),
    )
    .optional(),
})
export type ReportDetail = z.output<typeof reportDetailSchema>

export const reportsSearchSchema = z.object({
  q: z.preprocess(
    (value) =>
      typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : value,
    z.string().trim().max(160).catch('').default(''),
  ),
  status: reportStatusSchema.optional().catch(undefined),
  category: reportCategorySchema.optional().catch(undefined),
  priority: reportPrioritySchema.optional().catch(undefined),
  sort: reportSortSchema.optional().catch(undefined),
  dateFrom: calendarDateSchema.optional().catch(undefined),
  dateTo: calendarDateSchema.optional().catch(undefined),
  page: pageSearchSchema.default(1),
  pageSize: pageSizeSearchSchema.default(20),
})

export type ReportListItem = z.output<typeof reportListItemSchema>
export type ReportsSearch = z.output<typeof reportsSearchSchema>

export function reportDateRangeError({ dateFrom, dateTo }: ReportsSearch) {
  return dateFrom && dateTo && dateFrom > dateTo
    ? 'Start date must be on or before end date.'
    : undefined
}
