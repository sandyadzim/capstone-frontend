import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '@/features/admin/dashboard/dashboard-page'

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Dashboard · Admin · Property' }] }),
  component: DashboardPage,
})
