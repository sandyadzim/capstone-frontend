import { createFileRoute } from '@tanstack/react-router'
import { MaintenanceExample } from '@/features/maintenance-example/maintenance-example'

export const Route = createFileRoute('/_resident/examples/form')({
  head: () => ({ meta: [{ title: 'Example form · Resident · Property' }] }),
  component: MaintenanceExample,
})
