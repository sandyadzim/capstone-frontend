import { requirePortal } from '@/features/auth/auth-guards'
import { AuthRouteError } from '@/features/auth/components/session-feedback'
import { createFileRoute } from '@tanstack/react-router'
import { ResidentLayout } from '@/layouts/mobile-layout'

export const Route = createFileRoute('/_resident')({
  beforeLoad: ({ context, location }) =>
    requirePortal(context.queryClient, 'RESIDENT', location.href),
  errorComponent: AuthRouteError,
  component: ResidentLayout,
})
