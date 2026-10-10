import { requirePortal } from '@/features/auth/auth-guards'
import { AuthRouteError } from '@/features/auth/components/session-feedback'
import { createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '@/layouts/admin-layout'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
  beforeLoad: ({ context, location }) =>
    requirePortal(context.queryClient, 'ADMIN', location.href),
  errorComponent: AuthRouteError,
})
