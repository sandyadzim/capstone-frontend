import { createFileRoute } from '@tanstack/react-router'
import { MaintenanceExample } from '@/features/maintenance-example/maintenance-example'

export const Route = createFileRoute('/admin/examples/form')({
  head: () => ({ meta: [{ title: 'Example form · Admin · Property' }] }),
  component: MaintenanceExample,
})
