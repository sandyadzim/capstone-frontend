import { useEffect } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportsQueryOptions } from '@/features/admin/reports/report-queries'
import { reportsSearchSchema } from '@/features/admin/reports/report-schema'
import { sessionKey } from '@/features/auth/auth-session'
import { ApiError } from '@/lib/api/error'
import { DashboardSummary } from './dashboard-summary'
import { DashboardActivity } from './dashboard-activity'
import { DashboardQueue } from './dashboard-queue'
import {
  dashboardSummaryQueryOptions,
  dashboardTrendsQueryOptions,
} from './dashboard-queries'
import { dashboardQueues } from './dashboard-schema'
import './dashboard.css'

export function DashboardPage() {
  const { queue, sort } = getRouteApi('/admin/').useSearch()
  const navigate = useNavigate({ from: '/admin/' })
  const client = useQueryClient()
  const summary = useQuery(dashboardSummaryQueryOptions())
  const trends = useQuery(dashboardTrendsQueryOptions())
  const queues = useQueries({
    queries: dashboardQueues.map(({ status }) =>
      reportsQueryOptions({
        status,
        page: 1,
        pageSize: 5,
        ...(sort === 'priority' ? { sort } : {}),
      }),
    ),
  })
  const errors = [
    summary.error,
    trends.error,
    ...queues.map((query) => query.error),
  ]
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
              void trends.refetch()
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
      <DashboardActivity query={trends} />
      <DashboardQueue
        selected={queue}
        sort={sort}
        changeSort={(sort) => {
          void navigate({
            search: (previous) => ({ ...previous, sort }),
            resetScroll: false,
          })
        }}
        queries={queues}
        select={(queue) => {
          void navigate({
            search: (previous) => ({ ...previous, queue }),
            resetScroll: false,
          })
        }}
      />
    </div>
  )
}
