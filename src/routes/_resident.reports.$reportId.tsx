import { createFileRoute } from '@tanstack/react-router'
import { ResidentReportDetail } from '@/features/resident/resident-report-detail'

export const Route = createFileRoute('/_resident/reports/$reportId')({
  head: () => ({ meta: [{ title: 'Report details · Property' }] }),
  component: ResidentReportDetail,
})
