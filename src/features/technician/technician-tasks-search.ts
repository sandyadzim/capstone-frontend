import { z } from 'zod'
import { pageSearchSchema } from '@/lib/schemas/pagination'

export const technicianTasksSearchSchema = z.object({
  view: z.enum(['ongoing', 'history']).catch('ongoing').default('ongoing'),
  page: pageSearchSchema.default(1),
})
export type TechnicianTasksSearch = z.output<typeof technicianTasksSearchSchema>

export const technicianTaskSourceSchema = z.object({
  from: z.literal('tasks').optional().catch(undefined),
})
