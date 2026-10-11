import { createFileRoute } from '@tanstack/react-router'
import { ReportDetailPage } from '@/features/admin/reports/pages/report-detail-page'

export const Route = createFileRoute('/admin/reports/$reportId')({
  head: () => ({ meta: [{ title: 'Report details · Admin · Property' }] }),
  component: ReportDetailPage,
})
