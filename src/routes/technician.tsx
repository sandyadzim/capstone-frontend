import { requirePortal } from '@/features/auth/auth-guards'
import { AuthRouteError } from '@/features/auth/components/session-feedback'
import { createFileRoute } from '@tanstack/react-router'
import { TechnicianLayout } from '@/layouts/mobile-layout'

export const Route = createFileRoute('/technician')({
  beforeLoad: ({ context, location }) =>
    requirePortal(context.queryClient, 'TECHNICIAN', location.href),
  errorComponent: AuthRouteError,
  component: TechnicianLayout,
})
