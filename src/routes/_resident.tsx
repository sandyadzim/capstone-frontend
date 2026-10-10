import { requirePortal } from '@/features/auth/routing'
import { AuthRouteError } from '@/features/auth/portal-session'
import { createFileRoute } from '@tanstack/react-router'
import { ResidentLayout } from '@/layouts/mobile-layout'

export const Route = createFileRoute('/_resident')({
  beforeLoad: ({ context, location }) =>
    requirePortal(context.queryClient, 'RESIDENT', location.href),
  errorComponent: AuthRouteError,
  component: ResidentLayout,
})
