import { createFileRoute } from '@tanstack/react-router'
import { TechnicianHome } from '@/components/portal-home'

export const Route = createFileRoute('/technician/')({
  head: () => ({ meta: [{ title: 'Technician · Property' }] }),
  component: TechnicianHome,
})
