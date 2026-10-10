import { getErrorMessage } from '@/lib/api/error'
import { Link } from '@tanstack/react-router'
import { useQuery, useIsMutating } from '@tanstack/react-query'
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
import {
  UnitStatus,
  UnitStatusBadge,
  UnitArchivedBadge,
} from '../components/unit-page'
import { UnitRowActions } from '../components/unit-row-actions'
import { UnitMobileRecord } from '../components/unit-mobile-record'
import { unitsQueryOptions, unitsKey } from '../unit-queries'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { useUnitNavigation } from '../hooks/use-unit-navigation'
import { unitDisplayStatusSchema, type Unit } from '../unit-schema'

export function UnitsPage() {
  const { search, changeSearch } = useUnitNavigation()
  const { page, pageSize, isArchived, q, displayStatus } = search
  const busy = useIsMutating({ mutationKey: unitsKey }) > 0
  const query = useQuery({
    ...unitsQueryOptions({
      page,
      pageSize,
      isArchived: isArchived ? 'true' : 'false',
      q: q.trim() || undefined,
      displayStatus: displayStatus ?? undefined,
    }),
    enabled: !busy,
  })
  usePageCorrection(query.data?.meta, page, (page) =>
    changeSearch({ page }, true),
  )
  const columns: DataColumn<Unit>[] = [
    {
      id: 'number',
      header: 'Unit',
      cell: (unit) => (
        <Link
          to="/admin/units/$unitId"
          params={{ unitId: unit.id }}
          search={search}
          className="inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {unit.unitNumber}
        </Link>
      ),
    },
    { id: 'floor', header: 'Floor', cell: (unit) => unit.floor },
    {
      id: 'status',
      header: 'Status',
      width: 150,
      cell: (unit) => <UnitStatus unit={unit} showArchived={false} />,
    },
    {
      id: 'archived',
      header: 'Archived',
      cell: (unit) => <UnitArchivedBadge archived={unit.isArchived} />,
    },
    {
      id: 'resident',
      header: 'Resident',
      cell: (unit) => unit.activeResident?.name ?? 'No resident',
    },
    {
      id: 'actions',
      header: 'Actions',
      sticky: 'right',
      cell: (unit) => <UnitRowActions unit={unit} search={search} />,
    },
  ]

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Units</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Manage units, resident placement, and maintenance history.
          </p>
        </div>
        <Button
          className="min-h-11 px-4"
          nativeButton={false}
          role="link"
          render={<Link to="/admin/units/new" search={search} />}
        >
          <Plus aria-hidden="true" />
          Create unit
        </Button>
      </div>
      <Card className="mt-6 gap-0 py-0">
        <ListFilters
          search={
            <SearchFilter
              label="Search"
              placeholder="Search unit number"
              value={q}
              maxLength={40}
              onChange={(q) => changeSearch({ q, page: 1 }, true)}
            />
          }
        >
          <SelectFilter
            label="Status"
            placeholder="Select status"
            value={displayStatus}
            clearable
            options={[
              {
                value: 'VACANT',
                label: 'Vacant',
                content: <UnitStatusBadge status="VACANT" />,
              },
              {
                value: 'OCCUPIED',
                label: 'Occupied',
                content: <UnitStatusBadge status="OCCUPIED" />,
              },
              {
                value: 'MAINTENANCE',
                label: 'Maintenance',
                content: <UnitStatusBadge status="MAINTENANCE" />,
              },
            ]}
            onChange={(value) =>
              changeSearch({
                displayStatus:
                  value === null ? null : unitDisplayStatusSchema.parse(value),
                page: 1,
              })
            }
          />
          <SelectFilter
            label="Archived"
            placeholder="Archived"
            value={String(isArchived)}
            options={[
              {
                value: 'false',
                label: 'No',
                content: <UnitArchivedBadge archived={false} />,
              },
              {
                value: 'true',
                label: 'Yes',
                content: <UnitArchivedBadge archived />,
              },
            ]}
            onChange={(value) =>
              changeSearch({
                isArchived: value === 'true',
                page: 1,
              })
            }
          />
        </ListFilters>
        <DataTable
          label="Units"
          columns={columns}
          rows={query.data?.data ?? []}
          rowId={(unit) => unit.id}
          mobileRecord={(unit) => (
            <UnitMobileRecord unit={unit} search={search} />
          )}
          loading={query.isPending}
          updating={query.isFetching && !query.isPending}
          error={query.error ? getErrorMessage(query.error) : undefined}
          onRetry={() => {
            void query.refetch()
          }}
          emptyMessage={
            q.trim() || displayStatus
              ? 'No units match your filters.'
              : isArchived
                ? 'No archived units.'
                : 'No active units. Create a unit to get started.'
          }
        />
        {query.data && (
          <Pagination
            meta={query.data.meta}
            disabled={query.isFetching || busy}
            onPageChange={(page) => changeSearch({ page })}
            onPageSizeChange={(pageSize) => changeSearch({ pageSize, page: 1 })}
          />
        )}
      </Card>
    </div>
  )
}
