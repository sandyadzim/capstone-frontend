import { createFileRoute } from '@tanstack/react-router'
import { UnitHistoryPage } from '@/features/admin/units/pages/unit-history-page'
export const Route = createFileRoute('/admin/units/$unitId/history/')({
  head: () => ({ meta: [{ title: 'Maintenance History · Admin · Property' }] }),
  component: UnitHistoryPage,
})
