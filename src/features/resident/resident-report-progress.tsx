import { Check, Circle } from 'lucide-react'
import type { ReportDetail } from '@/features/admin/reports/report-schema'
import { reportStatusLabels } from '@/features/admin/reports/report-labels'
import { formatDate } from '@/lib/format'

const progressSteps = [
  'REPORTED',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
] as const

export function ResidentReportProgress({ report }: { report: ReportDetail }) {
  const steps =
    report.status === 'REJECTED'
      ? (['REPORTED', 'REJECTED'] as const)
      : progressSteps
  const currentIndex = steps.findIndex((status) => status === report.status)

  return (
    <section aria-labelledby="report-progress-heading">
      <h2 id="report-progress-heading" className="mb-5 text-base font-semibold">
        Report progress
      </h2>
      <ol aria-label="Report progress">
        {steps.map((status, index) => {
          const current = index === currentIndex
          const reached = index <= currentIndex
          // Only these milestones have recorded dates in the detail response.
          const date =
            status === 'REPORTED'
              ? report.reportedAt
              : status === 'ASSIGNED'
                ? report.assignment?.assignedAt
                : status === 'CLOSED'
                  ? report.closedAt
                  : null

          return (
            <li
              key={status}
              aria-current={current ? 'step' : undefined}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-7 bottom-0 left-3.5 border-l border-border"
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex size-7 shrink-0 items-center justify-center rounded-full border ${current ? (status === 'REJECTED' ? 'border-destructive/30 bg-destructive/10 text-destructive-text' : 'border-primary bg-primary text-primary-foreground') : reached ? 'border-primary/25 bg-accent text-primary' : 'border-border bg-background text-muted-foreground'}`}
              >
                {current ? (
                  <span className="size-2 rounded-full bg-current" />
                ) : reached ? (
                  <Check className="size-3.5" />
                ) : (
                  <Circle className="size-2" />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm leading-6 ${current ? 'font-semibold' : reached ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {reportStatusLabels[status]}
                  {current ? (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      Current
                    </span>
                  ) : (
                    <span className="sr-only">
                      {reached ? ' — Reached' : ' — Upcoming'}
                    </span>
                  )}
                </p>
                {reached && date && (
                  <time
                    dateTime={date}
                    className="block text-xs leading-5 text-muted-foreground"
                  >
                    {formatDate(date)}
                  </time>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
