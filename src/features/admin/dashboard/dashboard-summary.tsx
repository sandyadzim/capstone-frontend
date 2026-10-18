import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIdr } from '@/lib/format'
import { getErrorMessage } from '@/lib/api/error'
import type { DashboardSummary as Summary } from './dashboard-schema'

const count = (value: number | undefined) =>
  value === undefined ? '—' : value.toLocaleString('en-GB')

export function DashboardSummary({
  data,
  updatedAt,
  pending,
  fetching,
  error,
  retry,
}: {
  data?: Summary
  updatedAt: number
  pending: boolean
  fetching: boolean
  error: Error | null
  retry: () => void
}) {
  const metrics = [
    {
      label: 'Active reports',
      value: count(data?.activeReports),
      note: 'Includes completed work awaiting closure',
    },
    {
      label: 'In progress',
      value: count(data?.inProgressReports),
      note: 'Work underway with technicians',
    },
    {
      label: 'Closed this month',
      value: count(data?.closedReportsThisMonth),
      note: updatedAt
        ? new Intl.DateTimeFormat('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Jakarta',
          }).format(new Date(updatedAt))
        : 'Calendar month',
    },
    {
      label: 'Closed maintenance cost',
      value: data ? formatIdr(data.totalClosedCost) : '—',
      note: 'All time · Closed reports only',
    },
  ]
  return (
    <section aria-label="Maintenance summary" aria-busy={fetching}>
      {pending && (
        <p role="status" className="sr-only">
          Loading maintenance summary…
        </p>
      )}
      {fetching && !pending && (
        <p role="status" className="sr-only">
          Updating maintenance summary…
        </p>
      )}
      {error && (
        <div className="dashboard-read-error">
          <p role="alert">
            {data
              ? 'The summary could not be refreshed. Showing the last loaded figures. '
              : 'The maintenance summary could not be loaded. '}
            {getErrorMessage(error)}
          </p>
          <Button
            variant="outline"
            className="min-h-11 px-4"
            disabled={fetching}
            onClick={retry}
          >
            Retry summary
          </Button>
        </div>
      )}
      <dl className="dashboard-metrics">
        {metrics.map(({ label, value, note }) => (
          <div className="dashboard-metric" key={label}>
            <span className="dashboard-contour" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <dt>{label}</dt>
            <dd>
              <div className="dashboard-metric-value">
                {pending ? (
                  <Skeleton className="h-9 w-3/4" />
                ) : (
                  <span aria-label={!data ? `${label} unavailable` : undefined}>
                    {value}
                  </span>
                )}
              </div>
              <p>{note}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
