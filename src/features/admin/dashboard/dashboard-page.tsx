import { useEffect } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportsQueryOptions } from '@/features/admin/reports/report-queries'
import { reportsSearchSchema } from '@/features/admin/reports/report-schema'
import { sessionKey } from '@/features/auth/auth-session'
import { ApiError } from '@/lib/api/error'
import { DashboardSummary, DashboardContext } from './dashboard-summary'
import { DashboardQueue } from './dashboard-queue'
import { dashboardSummaryQueryOptions } from './dashboard-queries'
import { dashboardQueues } from './dashboard-schema'
import './dashboard.css'

export function DashboardPage() {
  const { queue } = getRouteApi('/admin/').useSearch()
  const navigate = useNavigate({ from: '/admin/' })
  const client = useQueryClient()
  const summary = useQuery(dashboardSummaryQueryOptions())
  const queues = useQueries({
    queries: dashboardQueues.map(({ status }) =>
      reportsQueryOptions({ status, page: 1, pageSize: 5 }),
    ),
  })
  const errors = [summary.error, ...queues.map((query) => query.error)]
  const forbidden = errors.some(
    (error) => error instanceof ApiError && error.statusCode === 403,
  )
  const denied =
    forbidden ||
    errors.some(
      (error) => error instanceof ApiError && error.statusCode === 401,
    )
  useEffect(() => {
    if (forbidden) void client.invalidateQueries({ queryKey: sessionKey })
  }, [client, forbidden])
  if (denied)
    return (
      <section className="admin-dashboard">
        <h1>Dashboard</h1>
        <div className="dashboard-read-error">
          <p role="alert">
            Dashboard access could not be confirmed. Your session is being
            checked.
          </p>
          <Button
            variant="outline"
            className="min-h-11 px-4"
            onClick={() => {
              void client.invalidateQueries({ queryKey: sessionKey })
              void summary.refetch()
              for (const query of queues) void query.refetch()
            }}
          >
            Retry
          </Button>
        </div>
      </section>
    )
  return (
    <div className="admin-dashboard">
      <div className="dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Your property’s maintenance, at a glance.</p>
        </div>
        <Button
          className="min-h-11 px-4"
          nativeButton={false}
          role="link"
          render={
            <Link
              to="/admin/reports/new"
              search={reportsSearchSchema.parse({})}
            />
          }
        >
          <Plus aria-hidden="true" /> Create report
        </Button>
      </div>
      <DashboardSummary
        data={summary.data}
        updatedAt={summary.dataUpdatedAt}
        pending={summary.isPending}
        fetching={summary.isFetching}
        error={summary.error}
        retry={() => {
          void summary.refetch()
        }}
      />
      <DashboardQueue
        selected={queue}
        queries={queues}
        select={(queue) => {
          void navigate({ search: { queue } })
        }}
      />
      <DashboardContext data={summary.data} pending={summary.isPending} />
    </div>
  )
}
