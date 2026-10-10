import { createFileRoute } from '@tanstack/react-router'
import { EditUnitPage } from '@/features/admin/units/pages/unit-form-page'
export const Route = createFileRoute('/admin/units/$unitId/edit')({
  head: () => ({ meta: [{ title: 'Edit Unit · Admin · Property' }] }),
  component: EditUnitPage,
})
