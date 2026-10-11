import { createFileRoute } from '@tanstack/react-router'
import { EditAccountPage } from '@/features/admin/accounts/pages/edit-account-page'
export const Route = createFileRoute('/admin/accounts/$accountId/edit')({
  head: () => ({ meta: [{ title: 'Edit account · Admin · Property' }] }),
  component: function EditAccountRoute() {
    const { accountId } = Route.useParams()
    return <EditAccountPage key={accountId} />
  },
})
