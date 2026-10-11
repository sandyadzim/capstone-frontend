import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/admin/reports/pages/reports-page'

export const Route = createFileRoute('/admin/reports/')({
  component: ReportsPage,
})
