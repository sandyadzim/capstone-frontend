import { createFileRoute } from '@tanstack/react-router'
import { AccountsPage } from '@/features/admin/accounts/pages/accounts-page'

export const Route = createFileRoute('/admin/accounts/')({
  component: function AccountsRoute() {
    const { role } = Route.useSearch()
    return <AccountsPage key={role ?? 'all'} />
  },
})
