import { getErrorMessage } from '@/lib/api/error'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery, useIsMutating } from '@tanstack/react-query'
import { z } from 'zod'
import { DataTable, type DataColumn } from '@/components/data-table'
import { Pagination } from '@/components/pagination'
import {
  UnitPage,
  UnitBreadcrumbs,
  UnitReadState,
  UnitUnavailable,
} from '../components/unit-page'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { useUnitNavigation } from '../hooks/use-unit-navigation'
import { useUnit, historyQueryOptions, unitsKey } from '../unit-queries'
import type { HistoryItem } from '../unit-schema'
import { formatDate, formatIdr } from '@/lib/format'

export function UnitHistoryPage() {
  const { unitId } = useParams({ from: '/admin/units/$unitId/history' })
  const { search, changeSearch } = useUnitNavigation(
    '/admin/units/$unitId/history',
  )
  const unitQuery = useUnit(unitId)
  const busy = useIsMutating({ mutationKey: unitsKey }) > 0
  const query = useQuery({
    ...historyQueryOptions(unitId, {
      page: search.historyPage,
      pageSize: search.historyPageSize,
    }),
    enabled: !!unitQuery.data && !busy,
  })
  usePageCorrection(query.data?.meta, search.historyPage, (historyPage) =>
    changeSearch({ historyPage }, true),
  )
  if (!z.uuid().safeParse(unitId).success)
    return <UnitUnavailable title="Invalid unit ID" search={search} />
  const columns: DataColumn<HistoryItem>[] = [
    {
      id: 'report',
      header: 'Report ID',
      width: 184,
      cell: (item) => <span className="font-medium">{item.reportNumber}</span>,
    },
    {
      id: 'title',
      header: 'Report Title',
      width: 280,
      cell: (item) => (
        <p
          className="line-clamp-2 max-w-72 whitespace-normal wrap-anywhere"
          title={item.title}
        >
          {item.title}
        </p>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: (item) =>
        item.category === 'AC'
          ? 'AC'
          : item.category.charAt(0) + item.category.slice(1).toLowerCase(),
    },
    {
      id: 'closed',
      header: 'Closed Date',
      width: 184,
      cell: (item) => formatDate(item.closedAt),
    },
    {
      id: 'technician',
      header: 'Technician',
      cell: (item) => item.technician?.name ?? 'No technician available',
    },
    {
      id: 'cost',
      header: 'Total cost (IDR)',
      cell: (item) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatIdr(item.totalCost)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      sticky: 'right',
      cell: (item) => (
        <Button
          variant="ghost"
          className="min-h-11 gap-2 px-3 text-primary"
          nativeButton={false}
          role="link"
          render={
            <Link
              to="/admin/units/$unitId/history/$reportId"
              params={{ unitId, reportId: item.id }}
              search={search}
            />
          }
        >
          View Detail <ArrowUpRight aria-hidden="true" />
        </Button>
      ),
    },
  ]
  return (
    <UnitPage
      wide
      title="Maintenance History"
      description={
        unitQuery.data
          ? `Closed maintenance reports for ${unitQuery.data.unitNumber}, newest first.`
          : 'Closed maintenance reports, newest first.'
      }
      breadcrumbs={
        <UnitBreadcrumbs
          current="Maintenance History"
          unitId={unitId}
          search={search}
        />
      }
      search={search}
    >
      {(unitQuery.isPending || unitQuery.error) && (
        <UnitReadState
          variant="records"
          loading={unitQuery.isPending}
          error={unitQuery.error}
          onRetry={() => {
            void unitQuery.refetch()
          }}
        />
      )}
      {unitQuery.data && (
        <Card className="gap-0 py-0">
          <div className="py-4">
            <DataTable
              label="Maintenance history"
              columns={columns}
              rows={query.data?.data ?? []}
              rowId={(item) => item.id}
              loading={query.isPending}
              updating={query.isFetching && !query.isPending}
              error={query.error ? getErrorMessage(query.error) : undefined}
              onRetry={() => {
                void query.refetch()
              }}
              emptyMessage="No closed maintenance reports for this unit."
            />
          </div>
          {query.data && (
            <Pagination
              meta={query.data.meta}
              disabled={query.isFetching || busy}
              onPageChange={(historyPage) => changeSearch({ historyPage })}
              onPageSizeChange={(historyPageSize) =>
                changeSearch({ historyPageSize, historyPage: 1 })
              }
            />
          )}
        </Card>
      )}
    </UnitPage>
  )
}
