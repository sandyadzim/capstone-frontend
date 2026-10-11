import type { ReactNode, Ref } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { accountRoles } from '../../admin-navigation'
import type { AccountsSearch } from '../account-schema'

export function AccountPage({
  title,
  description,
  search,
  accountId,
  headingRef,
  children,
}: {
  title: string
  description: string
  search: AccountsSearch
  accountId?: string
  headingRef?: Ref<HTMLHeadingElement>
  children: ReactNode
}) {
  return (
    <div className="min-w-0 max-w-3xl">
      <Breadcrumb aria-label="Breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
              render={
                <Link
                  to="/admin/accounts"
                  search={search}
                  activeOptions={{ exact: true }}
                />
              }
            >
              {search.role ? accountRoles[search.role] : 'All accounts'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {accountId && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink
                  className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
                  render={
                    <Link
                      to="/admin/accounts/$accountId"
                      activeOptions={{ exact: true }}
                      params={{ accountId }}
                      search={search}
                    />
                  }
                >
                  Account details
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="mt-2 text-3xl font-semibold tracking-tight outline-none wrap-anywhere"
      >
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  )
}

export function AccountReadState({
  loading,
  error,
  onRetry,
  form = false,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  form?: boolean
}) {
  if (loading)
    return (
      <section
        aria-label="Loading account"
        aria-busy="true"
        className="rounded-xl border bg-card p-5"
      >
        <p role="status" className="sr-only">
          Loading account…
        </p>
        <div
          aria-hidden="true"
          className={form ? 'space-y-5' : 'grid gap-5 sm:grid-cols-2'}
        >
          {Array.from({ length: form ? 3 : 7 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={form ? 'h-11 w-full' : 'h-6 w-3/4'} />
            </div>
          ))}
        </div>
      </section>
    )
  if (!error) return null
  const missing = error instanceof ApiError && error.statusCode === 404
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
      <p role="alert" className="flex-1 text-sm text-destructive-text">
        {missing
          ? 'Account not found. Return to the account list to choose another account.'
          : getErrorMessage(error)}
      </p>
      {!missing && (
        <Button variant="outline" className="min-h-11 px-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
