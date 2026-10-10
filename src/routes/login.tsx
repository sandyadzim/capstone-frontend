import { createFileRoute } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/login-page'
import { AuthRouteError } from '@/features/auth/portal-session'
import { loginSearch, requireGuest } from '@/features/auth/routing'

export const Route = createFileRoute('/login')({
  validateSearch: loginSearch,
  beforeLoad: ({ context, search }) =>
    requireGuest(context.queryClient, search.redirect),
  head: () => ({ meta: [{ title: 'Sign in · Property' }] }),
  errorComponent: AuthRouteError,
  component: function LoginRoute() {
    const search = Route.useSearch()
    return (
      <LoginPage
        redirect={search.redirect}
        expired={search.reason === 'expired'}
      />
    )
  },
})
