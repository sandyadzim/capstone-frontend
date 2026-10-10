import { createFileRoute } from '@tanstack/react-router'
import { UnitDetailPage } from '@/features/admin/units/pages/unit-detail-page'
export const Route = createFileRoute('/admin/units/$unitId/')({
  head: () => ({ meta: [{ title: 'Unit Details · Admin · Property' }] }),
  component: UnitDetailPage,
})
