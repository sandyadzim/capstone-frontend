import { createFileRoute } from '@tanstack/react-router'
import { UnitHistoryDetailPage } from '@/features/admin/units/pages/unit-history-detail-page'
export const Route = createFileRoute('/admin/units/$unitId/history/$reportId')({
  head: () => ({ meta: [{ title: 'History Details · Admin · Property' }] }),
  component: UnitHistoryDetailPage,
})
