import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/error'
import type { DashboardTrends } from './dashboard-schema'
import { DashboardTrendChart } from './dashboard-charts'

export function DashboardActivity({
  query,
}: {
  query: UseQueryResult<DashboardTrends>
}) {
  const { data } = query
  return (
    <section
      className="dashboard-activity"
      aria-labelledby="dashboard-activity-heading"
    >
      <div className="dashboard-activity-heading">
        <h2 id="dashboard-activity-heading">Maintenance activity</h2>
      </div>
      {query.error && (
        <div className="dashboard-read-error">
          <p role="alert">
            {data
              ? 'Could not refresh maintenance activity. Showing the last loaded data. '
              : ''}
            {getErrorMessage(query.error)}
          </p>
          <Button
            variant="outline"
            className="min-h-11 px-4"
            onClick={() => {
              void query.refetch()
            }}
          >
            Retry activity
          </Button>
        </div>
      )}
      {query.isFetching && data && (
        <p role="status" className="sr-only">
          Updating maintenance activity…
        </p>
      )}
      {(data || query.isPending) && (
        <div className="dashboard-activity-grid">
          {([false, true] as const).map((cost) => (
            <article
              key={String(cost)}
              className="dashboard-chart-card"
              aria-labelledby={
                cost ? 'dashboard-cost-title' : 'dashboard-reports-title'
              }
            >
              <h3
                id={cost ? 'dashboard-cost-title' : 'dashboard-reports-title'}
              >
                {cost ? 'Maintenance cost' : 'Reported vs closed'}
              </h3>
              {cost ? (
                <p className="dashboard-chart-caption">
                  Cost of reports closed each month.
                </p>
              ) : (
                <ul
                  className="dashboard-chart-legend"
                  aria-label="Report chart legend"
                >
                  <li>
                    <span className="dashboard-reported-key" />
                    Reported
                  </li>
                  <li>
                    <span className="dashboard-closed-key" />
                    Closed
                  </li>
                </ul>
              )}
              {data ? (
                <DashboardTrendChart months={data.months} cost={cost} />
              ) : (
                <div className="dashboard-chart-loading">
                  <Skeleton className="h-52 w-full" />
                  <p role="status" className="sr-only">
                    Loading {cost ? 'maintenance cost' : 'report activity'}…
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
