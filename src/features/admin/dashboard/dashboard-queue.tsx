import { Link } from '@tanstack/react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { DataTable, type DataColumn } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  ReportPriorityBadge,
  ReportStatusBadge,
} from '@/features/admin/reports/components/report-badges'
import { reportCategoryLabels } from '@/features/admin/reports/report-labels'
import {
  reportsSearchSchema,
  type ReportListItem,
  type ReportSort,
} from '@/features/admin/reports/report-schema'
import { ReportSortControl } from '@/features/admin/reports/components/report-sort-control'
import type { listReports } from '@/features/admin/reports/report-api'
import { getErrorMessage } from '@/lib/api/error'
import { formatDate } from '@/lib/format'
import { dashboardQueues, type DashboardQueue } from './dashboard-schema'

type QueueQuery = UseQueryResult<Awaited<ReturnType<typeof listReports>>>

export function DashboardQueue({
  selected,
  sort,
  changeSort,
  queries,
  select,
}: {
  selected: DashboardQueue
  sort: ReportSort
  changeSort: (sort: ReportSort) => void
  queries: QueueQuery[]
  select: (id: DashboardQueue) => void
}) {
  const index = dashboardQueues.findIndex((queue) => queue.id === selected)
  const queue = dashboardQueues[index]
  const query = queries[index]
  const search = reportsSearchSchema.parse({
    status: queue.status,
    sort: sort === 'priority' ? sort : undefined,
  })
  const columns: DataColumn<ReportListItem>[] = [
    {
      id: 'report',
      header: 'Report',
      width: 280,
      cell: (report) => (
        <Link
          className="dashboard-report-link"
          to="/admin/reports/$reportId"
          params={{ reportId: report.id }}
          search={search}
        >
          <small>{report.reportNumber}</small>
          <strong>{report.title}</strong>
        </Link>
      ),
    },
    {
      id: 'unit',
      header: 'Unit / Category',
      cell: (report) => (
        <div className="dashboard-unit">
          <span>{report.unit.unitNumber}</span>
          <small>{reportCategoryLabels[report.category]}</small>
        </div>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (report) => (
        <ReportPriorityBadge
          priority={report.finalPriority ?? report.proposedPriority}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (report) => <ReportStatusBadge status={report.status} />,
    },
    {
      id: 'reported',
      header: 'Reported · WIB',
      cell: (report) => (
        <span className="dashboard-reported">
          {formatDate(report.reportedAt)}
        </span>
      ),
    },
  ]
  return (
    <section
      className="dashboard-attention"
      aria-labelledby="dashboard-attention-heading"
    >
      <div className="dashboard-attention-heading">
        <div>
          <h2 id="dashboard-attention-heading">Needs attention</h2>
          <p className="dashboard-attention-description">
            Pick up the next step in your maintenance workflow.
          </p>
        </div>
        <ReportSortControl value={sort} onChange={changeSort} />
      </div>
      <div className="dashboard-queue-card">
        <div
          role="tablist"
          aria-label="Reports needing attention"
          className="dashboard-queue-tabs"
        >
          {dashboardQueues.map((item, i) => (
            <button
              key={item.id}
              id={`dashboard-tab-${item.id}`}
              role="tab"
              type="button"
              aria-controls="dashboard-queue-panel"
              aria-selected={selected === item.id}
              tabIndex={selected === item.id ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(event) => {
                if (
                  !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 2
                      : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3
                select(dashboardQueues[next].id)
                document
                  .getElementById(`dashboard-tab-${dashboardQueues[next].id}`)
                  ?.focus()
              }}
            >
              <span>{item.label}</span>{' '}
              <span
                className="dashboard-queue-count"
                aria-label={
                  queries[i].data
                    ? undefined
                    : queries[i].isPending
                      ? 'Count loading'
                      : 'Count unavailable'
                }
              >
                {queries[i].data
                  ? queries[i].data.meta.total.toLocaleString('en-GB')
                  : '—'}
              </span>
            </button>
          ))}
        </div>
        <div
          id="dashboard-queue-panel"
          role="tabpanel"
          aria-labelledby={`dashboard-tab-${selected}`}
          tabIndex={0}
        >
          <p className="dashboard-order-description">
            {sort === 'priority'
              ? 'High priority first, then oldest within each priority.'
              : 'Newest reported first.'}
          </p>
          <DataTable
            label={queue.label}
            columns={columns}
            rows={query.data?.data.slice(0, 5) ?? []}
            rowId={(report) => report.id}
            loading={query.isPending}
            updating={query.isFetching && !query.isPending}
            error={
              query.error
                ? `${query.data ? 'Could not refresh this queue. Showing the last loaded reports. ' : ''}${getErrorMessage(query.error)}`
                : undefined
            }
            onRetry={() => {
              void query.refetch()
            }}
            emptyMessage={queue.empty}
            mobileRecord={(report) => (
              <dl className="dashboard-mobile-report">
                {columns.map((column) => (
                  <div
                    className={
                      column.id === 'report' || column.id === 'reported'
                        ? 'dashboard-record-wide'
                        : ''
                    }
                    key={column.id}
                  >
                    <dt>{column.header}</dt>
                    <dd>{column.cell(report)}</dd>
                  </div>
                ))}
              </dl>
            )}
          />
          {query.data && (
            <div className="dashboard-queue-footer">
              <p>
                {sort === 'priority' ? 'Showing' : 'Latest'}{' '}
                {Math.min(query.data.data.length, 5)} of{' '}
                {query.data.meta.total.toLocaleString('en-GB')} ·{' '}
                {sort === 'priority'
                  ? 'priority, then oldest'
                  : 'by reported date'}
              </p>
              <Button
                nativeButton={false}
                role="link"
                variant="ghost"
                className="min-h-11 px-3 text-primary"
                render={<Link to="/admin/reports" search={search} />}
              >
                View all <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
