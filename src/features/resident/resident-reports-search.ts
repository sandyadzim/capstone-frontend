import { z } from 'zod'
import { pageSearchSchema } from '@/lib/schemas/pagination'

export const residentReportsSearchSchema = z.object({
  view: z.enum(['ongoing', 'history']).catch('ongoing').default('ongoing'),
  page: pageSearchSchema.default(1),
})
export type ResidentReportsSearch = z.output<typeof residentReportsSearchSchema>

export const residentReportSourceSchema = z.object({
  from: z.literal('reports').optional().catch(undefined),
})
