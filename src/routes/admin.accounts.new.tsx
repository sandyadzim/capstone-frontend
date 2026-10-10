import { createFileRoute } from '@tanstack/react-router'
import { CreateAccountPage } from '@/features/admin/accounts/pages/create-account-page'

export const Route = createFileRoute('/admin/accounts/new')({
  head: () => ({ meta: [{ title: 'Create account · Admin · Property' }] }),
  component: function CreateAccountRoute() {
    const { role } = Route.useSearch()
    return <CreateAccountPage key={role ?? 'all'} />
  },
})
