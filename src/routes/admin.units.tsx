import { createFileRoute } from '@tanstack/react-router'
import { AdminPlaceholder } from '@/features/admin/components/admin-placeholder'

export const Route = createFileRoute('/admin/units')({
  head: () => ({ meta: [{ title: 'Units · Admin · Property' }] }),
  component: () => (
    <AdminPlaceholder
      title="Units"
      description="Manage property units, resident placement, and maintenance history."
    />
  ),
})
