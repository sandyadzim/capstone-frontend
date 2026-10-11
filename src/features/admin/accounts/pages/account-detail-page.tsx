import { useRef, useState } from 'react'
import { getRouteApi, Link, useParams } from '@tanstack/react-router'
import { z } from 'zod'
import { toast } from '@/components/ui/toast'
import { formatDate } from '@/lib/format'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { useAccount } from '../account-queries'
import { accountRoleLabels } from '../account-utils'
import { useAccountMutations } from '../hooks/use-account-mutations'
import { AccountPage, AccountReadState } from '../components/account-page'
import { AccountStatusBadge } from '../components/account-status-badge'
import { AccountDetailActions } from '../components/account-detail-actions'
import { AccountConfirmationDialog } from '../components/account-confirmation-dialog'
import { AccountPasswordDialog } from '../components/account-password-dialog'

export function AccountDetailPage() {
  const { accountId } = useParams({ from: '/admin/accounts/$accountId/' })
  const search = getRouteApi('/admin/accounts').useSearch()
  const { actor } = getRouteApi('/admin').useRouteContext()
  const query = useAccount(accountId)
  const mutations = useAccountMutations(accountId)
  const [confirmation, setConfirmation] = useState<
    'activate' | 'deactivate' | null
  >(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)
  const returnToHeading = useRef(false)
  const own = actor.id.toLowerCase() === accountId.toLowerCase()
  const account =
    query.error instanceof ApiError && query.error.statusCode === 404
      ? undefined
      : query.data
  const valid = z.uuid().safeParse(accountId).success

  async function confirm() {
    if (
      !confirmation ||
      mutations.busy ||
      (own && confirmation === 'deactivate')
    )
      return
    try {
      const result =
        confirmation === 'activate'
          ? await mutations.activate()
          : await mutations.deactivate()
      if (result) {
        returnToHeading.current = true
        setConfirmation(null)
      }
    } catch (error) {
      toast.add({
        title:
          confirmation === 'activate'
            ? 'Unable to activate account'
            : 'Unable to deactivate account',
        description: getErrorMessage(error),
        type: 'error',
      })
    }
  }

  return (
    <AccountPage
      title={valid ? 'Account details' : 'Invalid account ID'}
      description="Account information and access to your property."
      search={search}
      headingRef={headingRef}
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
            onRetry={() => {
              void query.refetch()
            }}
          />
          {account && (
            <section
              aria-label="Account information"
              aria-busy={query.isFetching || mutations.busy}
              className="rounded-xl border bg-card p-5"
            >
              {query.isFetching && (
                <p role="status" className="sr-only">
                  Updating account…
                </p>
              )}
              <dl className="grid gap-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Name</dt>
                  <dd className="mt-1 text-sm font-medium wrap-anywhere">
                    {account.name}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Login ID</dt>
                  <dd className="mt-1 text-sm font-medium wrap-anywhere">
                    {account.loginIdentifier}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Role</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {accountRoleLabels[account.role]}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <AccountStatusBadge active={account.isActive} />
                  </dd>
                </div>
                {account.role === 'RESIDENT' && (
                  <div className="min-w-0">
                    <dt className="text-sm text-muted-foreground">Unit</dt>
                    <dd className="mt-1 text-sm font-medium wrap-anywhere">
                      {account.activeUnit ? (
                        <Link
                          to="/admin/units/$unitId"
                          params={{ unitId: account.activeUnit.id }}
                          className="inline-flex min-h-11 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {account.activeUnit.unitNumber}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDate(account.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Updated</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDate(account.updatedAt)}
                  </dd>
                </div>
              </dl>
              <AccountDetailActions
                account={account}
                search={search}
                own={own}
                busy={mutations.busy}
                triggerRef={actionsRef}
                onPassword={() => setPasswordOpen(true)}
                onStatus={() => {
                  returnToHeading.current = false
                  setConfirmation(account.isActive ? 'deactivate' : 'activate')
                }}
              />
            </section>
          )}
          {account && (
            <AccountConfirmationDialog
              open={confirmation !== null}
              busy={mutations.busy}
              title={`${confirmation === 'activate' ? 'Activate' : 'Deactivate'} ${account.name}?`}
              description={
                confirmation === 'activate'
                  ? `This account will be able to sign in.${account.role === 'RESIDENT' ? ' Any previous resident placement will not be restored.' : ''}`
                  : `This account will no longer be able to sign in, and all its sessions will end. Account history remains available.${account.activeUnit ? ` The resident will be released from ${account.activeUnit.unitNumber}.` : ''}`
              }
              confirmLabel={
                confirmation === 'activate'
                  ? 'Activate account'
                  : 'Deactivate account'
              }
              destructive={confirmation === 'deactivate'}
              finalFocus={() =>
                returnToHeading.current
                  ? headingRef.current
                  : actionsRef.current
              }
              onCancel={() => setConfirmation(null)}
              onConfirm={() => {
                void confirm()
              }}
            />
          )}
          {account && (
            <AccountPasswordDialog
              open={passwordOpen}
              account={account}
              own={own}
              busy={mutations.busy}
              finalFocus={actionsRef}
              onChangePassword={mutations.changePassword}
              onClose={() => setPasswordOpen(false)}
            />
          )}
        </>
      )}
    </AccountPage>
  )
}
