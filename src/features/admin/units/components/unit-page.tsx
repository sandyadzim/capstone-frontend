import { getErrorMessage } from '@/lib/api/error'
import type { ReactNode, Ref } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { UnitSkeleton, type UnitSkeletonVariant } from './unit-skeleton'
import type { Unit, UnitsSearch } from '../unit-schema'

export function UnitBreadcrumbs({
  current,
  search,
  unitId,
  historyDetail = false,
}: {
  current: string
  search: UnitsSearch
  unitId?: string
  historyDetail?: boolean
}) {
  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
            render={<Link to="/admin/units" search={search} />}
          >
            Units
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {unitId && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
                render={
                  <Link
                    to="/admin/units/$unitId"
                    params={{ unitId }}
                    search={search}
                  />
                }
              >
                Unit Details
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        {unitId && historyDetail && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
                render={
                  <Link
                    to="/admin/units/$unitId/history"
                    params={{ unitId }}
                    search={search}
                  />
                }
              >
                Maintenance History
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function UnitPage({
  title,
  description,
  children,
  search,
  headingRef,
  breadcrumbs,
  wide = false,
}: {
  title: string
  description: string
  children: ReactNode
  search: UnitsSearch
  headingRef?: Ref<HTMLHeadingElement>
  breadcrumbs?: ReactNode
  wide?: boolean
}) {
  return (
    <div className={`min-w-0 ${wide ? '' : 'max-w-3xl'}`}>
      {breadcrumbs ?? (
        <Link
          to="/admin/units"
          search={search}
          className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          All units
        </Link>
      )}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className="text-3xl font-semibold tracking-tight outline-none wrap-anywhere"
          >
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  )
}

export function UnitArchivedBadge({ archived }: { archived: boolean }) {
  return (
    <Badge variant={archived ? 'outline' : 'secondary'}>
      {archived ? 'Yes' : 'No'}
    </Badge>
  )
}

export function UnitStatusBadge({ status }: { status: Unit['displayStatus'] }) {
  const styles = {
    VACANT: {
      label: 'Vacant',
      className: 'bg-status-vacant text-status-vacant-foreground',
    },
    OCCUPIED: {
      label: 'Occupied',
      className: 'bg-status-occupied text-status-occupied-foreground',
    },
    MAINTENANCE: {
      label: 'Maintenance',
      className: 'bg-status-maintenance text-status-maintenance-foreground',
    },
  }
  return (
    <Badge variant="secondary" className={styles[status].className}>
      {styles[status].label}
    </Badge>
  )
}

export function UnitStatus({
  unit,
  showArchived = true,
}: {
  unit: Unit
  showArchived?: boolean
}) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <UnitStatusBadge status={unit.displayStatus} />
      {showArchived && unit.isArchived && (
        <Badge variant="outline">Archived</Badge>
      )}
    </span>
  )
}

export function UnitReadState({
  loading,
  error,
  onRetry,
  variant,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  variant?: UnitSkeletonVariant
}) {
  if (loading) return <UnitSkeleton variant={variant} />
  if (!error) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
      <p role="alert" className="flex-1 text-sm text-destructive-text">
        {getErrorMessage(error)}
      </p>
      <Button variant="outline" className="min-h-11 px-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function UnitUnavailable({
  title,
  search,
}: {
  title: string
  search: UnitsSearch
}) {
  return (
    <UnitPage
      title={title}
      description="Return to the unit list to choose an available unit."
      search={search}
    >
      <p role="alert" className="text-sm text-destructive-text">
        This unit cannot be changed.
      </p>
    </UnitPage>
  )
}

export function UnitLink({
  id,
  search,
  children,
  to = '/admin/units/$unitId',
}: {
  id: string
  search: UnitsSearch
  children: ReactNode
  to?:
    | '/admin/units/$unitId'
    | '/admin/units/$unitId/edit'
    | '/admin/units/$unitId/history'
}) {
  return (
    <Button
      variant="outline"
      className="min-h-11 px-4"
      nativeButton={false}
      role="link"
      render={<Link to={to} params={{ unitId: id }} search={search} />}
    >
      {children}
    </Button>
  )
}
