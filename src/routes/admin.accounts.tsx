import { createFileRoute } from '@tanstack/react-router'
import { AccountsPage } from '@/features/admin/accounts/pages/accounts-page'
import {
  accountRoles,
  accountsSearchSchema,
} from '@/features/admin/admin-navigation'

export const Route = createFileRoute('/admin/accounts')({
  validateSearch: accountsSearchSchema,
  head: ({ match }) => ({
    meta: [
      {
        title: `${match.search.role ? accountRoles[match.search.role] : 'All accounts'} · Admin · Property`,
      },
    ],
  }),
  component: function AccountsRoute() {
    const { role } = Route.useSearch()
    return <AccountsPage key={role ?? 'all'} />
  },
})
