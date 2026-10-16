import { createFileRoute } from '@tanstack/react-router'
import { ResidentReportDetail } from '@/features/resident/resident-report-detail'

import { residentReportSourceSchema } from '@/features/resident/resident-reports-search'

export const Route = createFileRoute('/_resident/reports/$reportId')({
  validateSearch: residentReportSourceSchema,
  head: () => ({ meta: [{ title: 'Report details · Property' }] }),
  component: ResidentReportDetail,
})
