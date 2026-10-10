import { createFileRoute } from '@tanstack/react-router'
import { NewUnitPage } from '@/features/admin/units/pages/unit-form-page'
export const Route = createFileRoute('/admin/units/new')({
  head: () => ({ meta: [{ title: 'Create Unit · Admin · Property' }] }),
  component: NewUnitPage,
})
