import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ResidentReportCard } from './resident-report-card'
import { ReadError } from '@/components/read-feedback'
import { residentReportsQueryOptions } from './resident-queries'

export function ResidentOngoingReports({
  actorId,
  unitId,
}: {
  actorId: string
  unitId: string
}) {
  const reports = useQuery(residentReportsQueryOptions(actorId, unitId))

  if (reports.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading ongoing reports"
        aria-busy="true"
        className="mt-6 space-y-4.25"
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="space-y-4 overflow-hidden rounded-2xl border bg-card p-4.5"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div aria-busy={reports.isFetching}>
      {reports.data &&
        (reports.data.data.length ? (
          <>
            <ul aria-label="Ongoing reports" className="mt-6 space-y-4.25">
              {reports.data.data.slice(0, 10).map((report) => (
                <ResidentReportCard key={report.id} report={report} />
              ))}
            </ul>
            {reports.data.meta.total > 10 && (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Showing the latest 10 ongoing reports.
              </p>
            )}
          </>
        ) : (
          <div className="mx-auto max-w-64 py-12 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground">
              <ClipboardList aria-hidden="true" className="size-7" />
            </div>
            <h3 className="text-base font-medium">No ongoing reports</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your maintenance requests and repair updates will appear here.
            </p>
          </div>
        ))}
      {reports.isFetching && (
        <p role="status" className="sr-only">
          Updating ongoing reports
        </p>
      )}
      {reports.isError && (
        <ReadError
          message={
            reports.data
              ? 'We couldn’t refresh your ongoing reports.'
              : 'We couldn’t load your ongoing reports.'
          }
          retry={() => {
            void reports.refetch()
          }}
          busy={reports.isFetching}
        />
      )}
    </div>
  )
}
