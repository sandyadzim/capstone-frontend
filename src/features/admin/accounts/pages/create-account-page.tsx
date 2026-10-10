import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { accountRoles } from '../../admin-navigation'
import { AccountForm } from '../components/account-form'
import { useCreateAccount } from '../hooks/use-create-account'

export function CreateAccountPage() {
  const search = getRouteApi('/admin/accounts').useSearch()
  const navigate = useNavigate({ from: '/admin/accounts/new' })
  const { create, busy } = useCreateAccount()

  return (
    <div className="min-w-0 max-w-3xl">
      <Breadcrumb aria-label="Breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
              render={<Link to="/admin/accounts" search={search} />}
            >
              {search.role ? accountRoles[search.role] : 'All accounts'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Create account</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Create account
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Set up an account and its access to your property.
      </p>
      <div className="mt-6">
        <AccountForm
          initialRole={search.role}
          busy={busy}
          onCreate={create}
          onCancel={() => {
            void navigate({ to: '/admin/accounts', search })
          }}
          onCreated={async (account) => {
            await navigate({
              to: '/admin/accounts',
              replace: true,
              search: {
                role: search.role ? account.role : undefined,
                q: '',
                isActive: undefined,
                page: 1,
                pageSize: search.pageSize,
              },
            })
          }}
        />
      </div>
    </div>
  )
}
