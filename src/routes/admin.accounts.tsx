import { createFileRoute, Outlet } from '@tanstack/react-router'
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
  component: Outlet,
})
