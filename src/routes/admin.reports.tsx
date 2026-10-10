import { createFileRoute } from '@tanstack/react-router'
import { AdminPlaceholder } from '@/features/admin/components/admin-placeholder'

export const Route = createFileRoute('/admin/reports')({
  head: () => ({ meta: [{ title: 'Reports · Admin · Property' }] }),
  component: () => (
    <AdminPlaceholder
      title="Reports"
      description="Review maintenance reports, assign technicians, and close completed work."
    />
  ),
})
