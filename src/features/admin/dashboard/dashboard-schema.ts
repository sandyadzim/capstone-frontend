import { z } from 'zod'
import { moneySchema } from '@/lib/schemas/common'

const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const dashboardSummarySchema = z.object({
  totalUnits: countSchema,
  totalReports: countSchema,
  activeReports: countSchema,
  inProgressReports: countSchema,
  closedReportsThisMonth: countSchema,
  totalClosedCost: moneySchema,
})
export type DashboardSummary = z.output<typeof dashboardSummarySchema>
export const dashboardSearchSchema = z.object({
  queue: z
    .enum(['review', 'assignment', 'closure'])
    .catch('review')
    .default('review'),
})
export type DashboardQueue = z.output<typeof dashboardSearchSchema>['queue']
export const dashboardQueues = [
  {
    id: 'review',
    label: 'Needs review',
    status: 'REPORTED',
    empty: 'No reports need review.',
  },
  {
    id: 'assignment',
    label: 'Needs technician',
    status: 'VERIFIED',
    empty: 'No reports need a technician.',
  },
  {
    id: 'closure',
    label: 'Ready for review',
    status: 'COMPLETED',
    empty: 'No completed work to review.',
  },
] as const
