import { getRouteApi, Link, useParams } from '@tanstack/react-router'
import { useQuery, useIsMutating } from '@tanstack/react-query'
import { useRef } from 'react'
import { z } from 'zod'
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
import { reportDetailQueryOptions, reportsKey } from '../report-queries'
import { ReportDetailSections } from '../components/report-detail-sections'
import { ReportAssignmentAction } from '../components/report-assignment-action'
import { ReportReviewActions } from '../components/report-review-actions'

export function ReportDetailPage() {
  const { reportId } = useParams({ from: '/admin/reports/$reportId' })
  const search = getRouteApi('/admin/reports').useSearch()
  const valid = z.uuid().safeParse(reportId).success
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reviewing =
    useIsMutating({
      mutationKey: [...reportsKey, 'review', reportId.toLowerCase()],
    }) > 0
  const assigning =
    useIsMutating({
      mutationKey: [...reportsKey, 'assign', reportId.toLowerCase()],
    }) > 0
  const query = useQuery({
    ...reportDetailQueryOptions(reportId),
    enabled: valid && !reviewing && !assigning,
  })
  const missing =
    query.error instanceof ApiError && query.error.statusCode === 404
  const report = missing ? undefined : query.data
  return (
    <div className="min-w-0 max-w-3xl">
      <Breadcrumb aria-label="Breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
              render={
                <Link
                  to="/admin/reports"
                  search={search}
                  activeOptions={{ exact: true }}
                />
              }
            >
              Reports
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Report details</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight outline-none"
      >
        Report details
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Maintenance report information and recorded work.
      </p>
      <div className="mt-6 space-y-5" aria-busy={valid && query.isFetching}>
        {!valid ? (
          <p
            role="alert"
            className="rounded-xl border bg-card p-5 text-sm text-destructive-text"
          >
            Invalid report ID. Return to Reports to choose an available report.
          </p>
        ) : (
          <>
            {query.isPending && (
              <section
                aria-label="Loading report"
                className="rounded-xl border bg-card p-5"
              >
                <p role="status" className="sr-only">
                  Loading report…
                </p>
                <div aria-hidden="true" className="space-y-5">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                  <div className="grid gap-5 sm:grid-cols-2">
                    {Array.from({ length: 8 }, (_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-3/4" />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {query.error && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
                <p
                  role="alert"
                  className="min-w-0 flex-1 text-sm text-destructive-text wrap-anywhere"
                >
                  {missing
                    ? 'Report not found. Return to Reports to choose another report.'
                    : getErrorMessage(query.error)}
                </p>
                {!missing && (
                  <Button
                    variant="outline"
                    className="min-h-11 px-4"
                    onClick={() => {
                      void query.refetch()
                    }}
                  >
                    Try again
                  </Button>
                )}
              </div>
            )}
            {report && (
              <>
                {query.isFetching && (
                  <p role="status" className="sr-only">
                    Updating report…
                  </p>
                )}
                <ReportDetailSections
                  report={report}
                  informationActions={
                    <>
                      <ReportReviewActions
                        report={report}
                        disabled={query.isFetching || !!query.error}
                        headingRef={headingRef}
                      />
                      <ReportAssignmentAction
                        report={report}
                        disabled={query.isFetching || !!query.error}
                        headingRef={headingRef}
                      />
                    </>
                  }
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
