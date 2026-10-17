import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { DashboardPage } from '@/features/admin/dashboard/dashboard-page'
import { dashboardSearchSchema } from '@/features/admin/dashboard/dashboard-schema'

export const Route = createFileRoute('/admin/')({
  validateSearch: dashboardSearchSchema,
  search: { middlewares: [stripSearchParams({ queue: 'review' })] },
  head: () => ({ meta: [{ title: 'Dashboard · Admin · Property' }] }),
  component: DashboardPage,
})
