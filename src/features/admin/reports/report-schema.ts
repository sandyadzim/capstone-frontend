import { z } from 'zod'
import { calendarDateSchema, timestampSchema } from '@/lib/schemas/common'
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
