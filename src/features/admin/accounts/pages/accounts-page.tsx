import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type DataColumn } from '@/components/data-table'
import {
  ListFilters,
  SearchFilter,
  SelectFilter,
} from '@/components/list-filters'
import { Pagination } from '@/components/pagination'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { getErrorMessage } from '@/lib/api/error'
import { accountRoles } from '../../admin-navigation'
import { AccountStatusBadge } from '../components/account-status-badge'
import { accountsQueryOptions } from '../account-queries'
import { AccountRowActions } from '../components/account-row-actions'
import { accountRoleLabels } from '../account-utils'
import type { Account, AccountsSearch } from '../account-schema'

function accountUnit(account: Account) {
  return account.role === 'RESIDENT'
    ? (account.activeUnit?.unitNumber ?? 'No unit')
    : '—'
}

export function AccountsPage() {
  const search = getRouteApi('/admin/accounts').useSearch()
  const navigate = useNavigate({ from: '/admin/accounts/' })
  const { role, q, isActive, page, pageSize } = search
  const title = role ? accountRoles[role] : 'All accounts'
  const query = useQuery(
    accountsQueryOptions({
      role,
      q: q || undefined,
      isActive,
      page,
      pageSize,
    }),
  )

  function changeSearch(patch: Partial<AccountsSearch>, replace = false) {
    void navigate({
      search: (previous) => ({ ...previous, ...patch }),
      replace,
    })
  }

  usePageCorrection(query.data?.meta, page, (page) =>
    changeSearch({ page }, true),
  )

  const columns: DataColumn<Account>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (account) => (
        <Link
          to="/admin/accounts/$accountId"
          params={{ accountId: account.id }}
          search={search}
          className="inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring wrap-anywhere"
        >
          {account.name}
        </Link>
      ),
    },
    {
      id: 'login',
      header: 'Login ID',
      cell: (account) => account.loginIdentifier,
    },
  ]
  if (!role)
    columns.push({
      id: 'role',
      header: 'Role',
      cell: (account) => accountRoleLabels[account.role],
    })
  columns.push({
    id: 'status',
    header: 'Status',
    cell: (account) => <AccountStatusBadge active={account.isActive} />,
  })
  if (!role || role === 'RESIDENT')
    columns.push({ id: 'unit', header: 'Unit', cell: accountUnit })
  columns.push({
    id: 'actions',
    header: 'Actions',
    sticky: 'right',
    cell: (account) => <AccountRowActions account={account} search={search} />,
  })

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <Button
          nativeButton={false}
          role="link"
          render={<Link to="/admin/accounts/new" search={search} />}
          className="min-h-11 px-4"
        >
          <Plus aria-hidden="true" /> Create account
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Browse accounts and their access status.
      </p>
      <Card className="mt-6 gap-0 py-0">
        <ListFilters
          search={
            <SearchFilter
              label="Search"
              placeholder="Search name or login ID"
              value={q}
              maxLength={254}
              onChange={(q) => changeSearch({ q, page: 1 }, true)}
            />
          }
        >
          <SelectFilter
            label="Status"
            placeholder="Select status"
            value={isActive ?? null}
            clearable
            options={[
              {
                value: 'true',
                label: 'Active',
                content: <AccountStatusBadge active />,
              },
              {
                value: 'false',
                label: 'Inactive',
                content: <AccountStatusBadge active={false} />,
              },
            ]}
            onChange={(value) =>
              changeSearch({
                isActive:
                  value === 'true' || value === 'false' ? value : undefined,
                page: 1,
              })
            }
          />
        </ListFilters>
        <DataTable
          label={title}
          columns={columns}
          rows={query.data?.data ?? []}
          rowId={(account) => account.id}
          mobileRecord={(account) => (
            <>
              <div className="flex items-start justify-between gap-3">
                <dl className="min-w-0 flex-1">
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd>{columns[0].cell(account)}</dd>
                </dl>
                <div className="shrink-0">
                  <AccountRowActions account={account} search={search} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {columns
                  .filter(
                    (column) => column.id !== 'name' && column.id !== 'actions',
                  )
                  .map((column) => (
                    <div
                      key={column.id}
                      className={`${column.id === 'login' ? 'col-span-2 ' : ''}min-w-0`}
                    >
                      <dt className="text-xs text-muted-foreground">
                        {column.header}
                      </dt>
                      <dd className="mt-1 wrap-anywhere">
                        {column.cell(account)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </>
          )}
          loading={query.isPending}
          updating={query.isFetching && !query.isPending}
          error={query.error ? getErrorMessage(query.error) : undefined}
          onRetry={() => {
            void query.refetch()
          }}
          emptyMessage={
            q || isActive
              ? 'No accounts match your filters.'
              : role
                ? `No ${title.toLowerCase()} yet.`
                : 'No accounts yet.'
          }
        />
        {query.data && (
          <Pagination
            meta={query.data.meta}
            disabled={query.isFetching}
            onPageChange={(page) => changeSearch({ page })}
            onPageSizeChange={(pageSize) => changeSearch({ pageSize, page: 1 })}
          />
        )}
      </Card>
    </div>
  )
}
