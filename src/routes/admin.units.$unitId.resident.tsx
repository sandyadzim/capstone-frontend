import { createFileRoute } from '@tanstack/react-router'
import { UnitResidentPage } from '@/features/admin/units/pages/unit-resident-page'
export const Route = createFileRoute('/admin/units/$unitId/resident')({
  head: () => ({ meta: [{ title: 'Resident Placement · Admin · Property' }] }),
  component: UnitResidentPage,
})
