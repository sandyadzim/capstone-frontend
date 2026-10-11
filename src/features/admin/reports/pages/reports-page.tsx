import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { DataTable, type DataColumn } from '@/components/data-table'
import { DateRangeFilter } from '@/components/date-range-filter'
import { Button } from '@/components/ui/button'
import {
  ListFilters,
  SearchFilter,
  SelectFilter,
} from '@/components/list-filters'
import { Pagination } from '@/components/pagination'
import { ReportRowActions } from '../components/report-row-actions'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { getErrorMessage } from '@/lib/api/error'
import { formatDate } from '@/lib/format'
import {
  ReportPriorityBadge,
  ReportStatusBadge,
} from '../components/report-badges'
import {
  reportCategoryLabels,
  reportPriorityLabels,
  reportStatusLabels,
} from '../report-labels'
import { reportsQueryOptions } from '../report-queries'
import {
  reportCategorySchema,
  reportDateRangeError,
  reportPrioritySchema,
  reportStatusSchema,
  type ReportListItem,
  type ReportsSearch,
} from '../report-schema'

const reportColumns = (search: ReportsSearch): DataColumn<ReportListItem>[] => [
  {
    id: 'number',
    header: 'Report ID',
    cell: (report) => (
      <Link
        to="/admin/reports/$reportId"
        params={{ reportId: report.id }}
        search={search}
        className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {report.reportNumber}
      </Link>
    ),
  },
  {
    id: 'title',
    header: 'Report Title',
    width: 260,
    cell: (report) => (
      <span
        className="block max-w-80 whitespace-normal wrap-anywhere @min-[48rem]:line-clamp-2"
        title={report.title}
      >
        {report.title}
      </span>
    ),
  },
  { id: 'unit', header: 'Unit', cell: (report) => report.unit.unitNumber },
  {
    id: 'category',
    header: 'Category',
    cell: (report) => reportCategoryLabels[report.category],
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
    header: 'Reported Date',
    cell: (report) => formatDate(report.reportedAt),
  },
  {
    id: 'actions',
    header: 'Actions',
    sticky: 'right',
    cell: (report) => <ReportRowActions report={report} search={search} />,
  },
]

export function ReportsPage() {
  const search = getRouteApi('/admin/reports').useSearch()
  const columns = reportColumns(search)
  const navigate = useNavigate({ from: '/admin/reports' })
  const { q, status, category, priority, dateFrom, dateTo, page, pageSize } =
    search
  const rangeError = reportDateRangeError(search)
  const datesValid = !rangeError
  const query = useQuery({
    ...reportsQueryOptions({
      q: q || undefined,
      status,
      category,
      priority,
      dateFrom,
      dateTo,
      page,
      pageSize,
    }),
    enabled: datesValid,
  })

  function changeSearch(patch: Partial<ReportsSearch>, replace = false) {
    void navigate({
      search: (previous) => ({ ...previous, ...patch }),
      replace,
    })
  }
  usePageCorrection(datesValid ? query.data?.meta : undefined, page, (page) =>
    changeSearch({ page }, true),
  )
  const filtered = !!(q || status || category || priority || dateFrom || dateTo)

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Browse maintenance reports and track their status.
          </p>
        </div>
        <Button
          nativeButton={false}
          role="link"
          className="min-h-11 px-4"
          render={<Link to="/admin/reports/new" search={search} />}
        >
          <Plus aria-hidden="true" /> Create report
        </Button>
      </div>
      <Card className="mt-6 gap-0 py-0">
        <ListFilters
          search={
            <SearchFilter
              label="Search"
              placeholder="Search report number or title"
              value={q}
              maxLength={160}
              onChange={(q) => changeSearch({ q, page: 1 }, true)}
            />
          }
        >
          <SelectFilter
            label="Category"
            placeholder="Select category"
            value={category ?? null}
            clearable
            options={reportCategorySchema.options.map((value) => ({
              value,
              label: reportCategoryLabels[value],
            }))}
            onChange={(value) =>
              changeSearch({
                category: reportCategorySchema
                  .optional()
                  .parse(value ?? undefined),
                page: 1,
              })
            }
          />
          <SelectFilter
            label="Status"
            placeholder="Select status"
            value={status ?? null}
            clearable
            options={reportStatusSchema.options.map((value) => ({
              value,
              label: reportStatusLabels[value],
              content: <ReportStatusBadge status={value} />,
            }))}
            onChange={(value) =>
              changeSearch({
                status: reportStatusSchema.optional().parse(value ?? undefined),
                page: 1,
              })
            }
          />
          <SelectFilter
            label="Priority"
            placeholder="Select priority"
            value={priority ?? null}
            clearable
            options={reportPrioritySchema.options.map((value) => ({
              value,
              label: reportPriorityLabels[value],
              content: <ReportPriorityBadge priority={value} />,
            }))}
            onChange={(value) =>
              changeSearch({
                priority: reportPrioritySchema
                  .optional()
                  .parse(value ?? undefined),
                page: 1,
              })
            }
          />
          <DateRangeFilter
            label="Reported Date"
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(range) => changeSearch({ ...range, page: 1 })}
            error={rangeError}
          />
        </ListFilters>
        {datesValid && (
          <>
            <DataTable
              label="Reports"
              columns={columns}
              rows={query.data?.data ?? []}
              rowId={(report) => report.id}
              mobileRecord={(report) => (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {columns.map((column) => (
                    <div
                      key={column.id}
                      className={`${column.id === 'number' || column.id === 'title' || column.id === 'reported' || column.id === 'actions' ? 'col-span-2 ' : ''}min-w-0`}
                    >
                      <dt className="text-xs text-muted-foreground">
                        {column.header}
                      </dt>
                      <dd className="mt-1 wrap-anywhere">
                        {column.cell(report)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              loading={query.isPending}
              updating={query.isFetching && !query.isPending}
              error={query.error ? getErrorMessage(query.error) : undefined}
              onRetry={() => {
                void query.refetch()
              }}
              emptyMessage={
                filtered ? 'No reports match your filters.' : 'No reports yet.'
              }
            />
            {query.data && (
              <Pagination
                meta={query.data.meta}
                disabled={query.isFetching}
                onPageChange={(page) => changeSearch({ page })}
                onPageSizeChange={(pageSize) =>
                  changeSearch({ pageSize, page: 1 })
                }
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
