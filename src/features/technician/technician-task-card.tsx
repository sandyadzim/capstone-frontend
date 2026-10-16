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
import { residentReportStatusStyles } from '@/features/resident/resident-report-status'
import { formatDate } from '@/lib/format'
import { Link } from '@tanstack/react-router'
import type { TechnicianTasksSearch } from './technician-tasks-search'

const categoryIcons = {
  AC: AirVent,
  ELECTRICAL: Zap,
  PLUMBING: Droplets,
  FURNITURE: Armchair,
  BUILDING: Building2,
  OTHER: Shapes,
}

export function TechnicianTaskCard({
  report,
  source,
}: {
  report: ReportListItem
  source?: TechnicianTasksSearch
}) {
  const Icon = categoryIcons[report.category]
  return (
    <li className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_2px_3px_#00000003,0_5px_14px_#00000004]">
      <Link
        to="/technician/tasks/$reportId"
        params={{ reportId: report.id }}
        search={source ? { from: 'tasks', ...source } : {}}
        aria-label={`View task: ${report.title}`}
        className="block rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <div className="px-4.5 pt-4.5 pb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="text-sm font-medium">
                {reportCategoryLabels[report.category]}
              </span>
            </div>
            <span className="shrink-0">
              <span className="sr-only">Priority: </span>
              <ReportPriorityBadge
                priority={report.finalPriority ?? report.proposedPriority}
              />
            </span>
          </div>
          <h3 className="mt-4 text-lg leading-6.5 font-medium tracking-tight wrap-anywhere">
            {report.title}
          </h3>
          <p className="mt-3 flex flex-wrap wrap-anywhere items-center gap-x-1.5 text-xs leading-5 text-muted-foreground">
            <Building2 aria-hidden="true" className="mr-1 size-3.5" />
            Unit {report.unit.unitNumber}
            <span aria-hidden="true">·</span>Floor {report.unit.floor}
          </p>
        </div>
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-t border-current/12 px-4.5 py-3.5 text-xs leading-4.5 ${residentReportStatusStyles[report.status]}`}
        >
          <span className="font-semibold">
            <span className="sr-only">Status: </span>
            {reportStatusLabels[report.status]}
          </span>
          <span>
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
