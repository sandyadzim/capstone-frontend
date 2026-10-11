import { createFileRoute } from '@tanstack/react-router'
import { CreateReportPage } from '@/features/admin/reports/pages/create-report-page'

export const Route = createFileRoute('/admin/reports/new')({
  head: () => ({ meta: [{ title: 'Create report · Admin · Property' }] }),
  component: CreateReportPage,
})
