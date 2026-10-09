import { createFileRoute } from '@tanstack/react-router'
import { TechnicianLayout } from '@/layouts/mobile-layout'

export const Route = createFileRoute('/technician')({
  component: TechnicianLayout,
})
