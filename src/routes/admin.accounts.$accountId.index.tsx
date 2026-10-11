import { createFileRoute } from '@tanstack/react-router'
import { AccountDetailPage } from '@/features/admin/accounts/pages/account-detail-page'
export const Route = createFileRoute('/admin/accounts/$accountId/')({
  head: () => ({ meta: [{ title: 'Account details · Admin · Property' }] }),
  component: function AccountDetailRoute() {
    const { accountId } = Route.useParams()
    return <AccountDetailPage key={accountId} />
  },
})
