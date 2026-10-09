import { createFileRoute } from '@tanstack/react-router'
import { MaintenanceExample } from '@/features/maintenance-example/maintenance-example'

export const Route = createFileRoute('/technician/examples/form')({
  head: () => ({ meta: [{ title: 'Example form · Technician · Property' }] }),
  component: MaintenanceExample,
})
