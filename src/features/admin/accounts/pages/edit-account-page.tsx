import { getRouteApi, useNavigate, useParams } from '@tanstack/react-router'
import { z } from 'zod'
import { ApiError } from '@/lib/api/error'
import { useAccount } from '../account-queries'
import { useAccountMutations } from '../hooks/use-account-mutations'
import { AccountEditForm } from '../components/account-edit-form'
import { AccountPage, AccountReadState } from '../components/account-page'

export function EditAccountPage() {
  const { accountId } = useParams({ from: '/admin/accounts/$accountId/edit' })
  const search = getRouteApi('/admin/accounts').useSearch()
  const { actor } = getRouteApi('/admin').useRouteContext()
  const navigate = useNavigate({ from: '/admin/accounts/$accountId/edit' })
  const query = useAccount(accountId)
  const mutations = useAccountMutations(accountId)
  const missing =
    query.error instanceof ApiError && query.error.statusCode === 404
  const valid = z.uuid().safeParse(accountId).success
  async function returnToDetail() {
    await navigate({
      to: '/admin/accounts/$accountId',
      params: { accountId },
      search,
    })
  }

  return (
    <AccountPage
      title={valid ? 'Edit account' : 'Invalid account ID'}
      description="Update the account name, login ID, or role."
      search={search}
      accountId={valid ? accountId : undefined}
    >
      {!valid ? (
        <p role="alert" className="text-sm text-destructive-text">
          Return to the account list to choose an available account.
        </p>
      ) : (
        <>
          <AccountReadState
            loading={query.isPending}
            error={query.error}
            form
            onRetry={() => {
              void query.refetch()
            }}
          />
          {query.data && !missing && (
            <AccountEditForm
              key={accountId}
              account={query.data}
              own={actor.id.toLowerCase() === accountId.toLowerCase()}
              busy={mutations.busy}
              onSave={mutations.update}
              onSaved={returnToDetail}
              onCancel={() => {
                void returnToDetail()
              }}
            />
          )}
        </>
      )}
    </AccountPage>
  )
}
