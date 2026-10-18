import type { DashboardSummary } from '@/features/admin/dashboard/dashboard-schema'
import { report } from '../reports/fixtures'

export const summary: DashboardSummary = {
  totalUnits: 128,
  totalReports: 486,
  activeReports: 24,
  inProgressReports: 8,
  closedReportsThisMonth: 17,
  totalClosedCost: '28750000.50',
}
export const dashboardReports = Array.from({ length: 5 }, (_, index) => ({
  ...report,
  id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  reportNumber: `RPT-${index + 1}`,
  title: `Maintenance report ${index + 1}`,
  finalPriority: index === 0 ? ('HIGH' as const) : null,
}))

export function makeTrends(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')!.value),
    month = Number(parts.find((part) => part.type === 'month')!.value)
  return {
    generatedAt: now.toISOString(),
    timeZone: 'Asia/Jakarta' as const,
    months: Array.from({ length: 6 }, (_, index) => ({
      month: new Date(Date.UTC(year, month - 6 + index, 1))
        .toISOString()
        .slice(0, 7),
      reportedCount: [16, 22, 18, 28, 19, 24][index],
      closedCount: [12, 18, 20, 22, 17, 21][index],
      closedCost: [
        '1250000.50',
        '2500000.00',
        '1750000.00',
        '3200000.75',
        '2100000.00',
        '2800000.00',
      ][index],
    })),
  }
}
