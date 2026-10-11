import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/admin/reports/pages/reports-page'
import { reportsSearchSchema } from '@/features/admin/reports/report-schema'

export const Route = createFileRoute('/admin/reports')({
  validateSearch: reportsSearchSchema,
  head: () => ({ meta: [{ title: 'Reports · Admin · Property' }] }),
  component: ReportsPage,
})
