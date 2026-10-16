import {
  AirVent,
  Armchair,
  Building2,
  Droplets,
  Shapes,
  Zap,
} from 'lucide-react'
import { ReportPriorityBadge } from '@/features/admin/reports/components/report-badges'
import {
  reportCategoryLabels,
  reportStatusLabels,
} from '@/features/admin/reports/report-labels'
import type { ReportListItem } from '@/features/admin/reports/report-schema'
import { formatDate } from '@/lib/format'
import { Link } from '@tanstack/react-router'
import { residentReportStatusStyles } from './resident-report-status'

const categoryIcons = {
  AC: AirVent,
  ELECTRICAL: Zap,
  PLUMBING: Droplets,
  FURNITURE: Armchair,
  BUILDING: Building2,
  OTHER: Shapes,
}

export function ResidentReportCard({ report }: { report: ReportListItem }) {
  const Icon = categoryIcons[report.category]
  return (
    <li className="min-w-0">
      <Link
        to="/reports/$reportId"
        params={{ reportId: report.id }}
        aria-label={`View report: ${report.title}`}
        className="block overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_2px_3px_#00000003,0_5px_14px_#00000004] hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="px-4.5 pt-4.5 pb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <div>
                <span className="block text-[10px] leading-3.5 font-semibold tracking-widest text-muted-foreground">
                  MAINTENANCE
                </span>
                <span className="block text-[13px] leading-5 font-medium">
                  {reportCategoryLabels[report.category]}
                </span>
              </div>
            </div>
            <span className="shrink-0">
              <span className="sr-only">Priority:</span>
              <ReportPriorityBadge
                priority={report.finalPriority ?? report.proposedPriority}
              />
            </span>
          </div>
          <h3 className="mt-4 text-lg leading-6.5 font-medium tracking-tight wrap-anywhere">
            {report.title}
          </h3>
        </div>
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-t border-current/12 px-4.5 py-3.5 ${residentReportStatusStyles[report.status]}`}
        >
          <span className="text-xs leading-4.5 font-semibold">
            <span className="sr-only">Status: </span>
            {reportStatusLabels[report.status]}
          </span>
          <span className="text-xs leading-4.5">
            Reported{' '}
            <time dateTime={report.reportedAt}>
              {formatDate(report.reportedAt)}
            </time>
          </span>
        </div>
      </Link>
    </li>
  )
}
