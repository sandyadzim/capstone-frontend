import { createFileRoute } from '@tanstack/react-router'
import { TechnicianProfile } from '@/features/technician/technician-profile'

export const Route = createFileRoute('/technician/profile')({
  head: () => ({ meta: [{ title: 'Profile · Technician · Property' }] }),
  component: TechnicianProfile,
})
