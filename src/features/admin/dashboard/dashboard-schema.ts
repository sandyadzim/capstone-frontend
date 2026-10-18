import { z } from 'zod'
import { moneySchema, timestampSchema } from '@/lib/schemas/common'
import { reportSortSchema } from '@/features/admin/reports/report-schema'

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
  sort: reportSortSchema.catch('latest').default('latest'),
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

export const dashboardTrendsSchema = z
  .object({
    generatedAt: timestampSchema,
    timeZone: z.literal('Asia/Jakarta'),
    months: z
      .array(
        z.object({
          month: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/),
          reportedCount: countSchema,
          closedCount: countSchema,
          closedCost: moneySchema,
        }),
      )
      .length(6),
  })
  .superRefine((value, ctx) => {
    if (!Number.isFinite(Date.parse(value.generatedAt))) return
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      timeZone: value.timeZone,
    }).formatToParts(new Date(value.generatedAt))
    const year = Number(parts.find((part) => part.type === 'year')?.value)
    const month = Number(parts.find((part) => part.type === 'month')?.value)
    for (const [index, item] of value.months.entries()) {
      const expected = new Date(Date.UTC(year, month - 6 + index, 1))
        .toISOString()
        .slice(0, 7)
      if (item.month !== expected)
        ctx.addIssue({
          code: 'custom',
          path: ['months', index, 'month'],
          message:
            'Expected six consecutive months ending with the generated Jakarta month.',
        })
    }
  })
export type DashboardTrends = z.output<typeof dashboardTrendsSchema>
export type DashboardTrendMonth = DashboardTrends['months'][number]
