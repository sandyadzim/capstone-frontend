import { createFileRoute } from '@tanstack/react-router'
import { AdminPlaceholder } from '@/features/admin/components/admin-placeholder'
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
  component: function AccountsPage() {
    const { role } = Route.useSearch()
    return (
      <AdminPlaceholder
        title={role ? accountRoles[role] : 'All accounts'}
        description="Manage administrator, resident, and technician accounts and their access."
      />
    )
  },
})
