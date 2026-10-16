import { createFileRoute } from '@tanstack/react-router'
import { ResidentReports } from '@/features/resident/resident-reports'

export const Route = createFileRoute('/_resident/reports/')({
  head: () => ({ meta: [{ title: 'Reports · Property' }] }),
  component: ResidentReports,
})
