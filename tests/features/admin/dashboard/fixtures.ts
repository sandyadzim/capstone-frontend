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
