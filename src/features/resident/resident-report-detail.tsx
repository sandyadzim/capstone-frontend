import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import {
  AirVent,
  Armchair,
  ArrowLeft,
  Building2,
  Clock3,
  Droplets,
  Shapes,
  UserRound,
  Zap,
} from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { ReportPriorityBadge } from '@/features/admin/reports/components/report-badges'
import { ReportPhotos } from '@/features/admin/reports/components/report-photos'
import {
  reportCategoryLabels,
  reportStatusLabels,
} from '@/features/admin/reports/report-labels'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { ApiError } from '@/lib/api/error'
import { formatDate, formatIdr } from '@/lib/format'
import { InformationLoading, ReadError } from '@/components/read-feedback'
import {
  residentReportDetailQueryOptions,
  residentUnitQueryOptions,
} from './resident-queries'
import {
  residentReportStatusHelp,
  residentReportStatusStyles,
} from './resident-report-status'
import type { ReportDetail } from '@/features/admin/reports/report-schema'
import { ResidentReportProgress } from './resident-report-progress'

export function ResidentReportDetail() {
  const { reportId } = useParams({ from: '/_resident/reports/$reportId' })
  const { from, view, page } = useSearch({
    from: '/_resident/reports/$reportId',
  })
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  const unit = useQuery({
    ...residentUnitQueryOptions(actor?.id ?? ''),
    enabled: !!actor,
  })
  const validId = z.uuid().safeParse(reportId).success
  const placement = unit.data?.unit

  return (
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background px-5 pt-[calc(.75rem+env(safe-area-inset-top))] pb-4">
        <Button
          nativeButton={false}
          role="link"
          variant="ghost"
          size="icon"
          className="size-11"
          render={
            <Link
              to={from === 'reports' ? '/reports' : '/'}
              search={from === 'reports' ? { view, page } : {}}
              aria-label={
                from === 'reports' ? 'Back to reports' : 'Back to home'
              }
            />
          }
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Report details</h1>
      </header>
      <div className="space-y-6 px-5 pb-8">
        {!validId ? (
          <p role="alert" className="text-sm leading-6 text-destructive-text">
            Invalid report ID. Return home to choose a report.
          </p>
        ) : unit.isPending ? (
          <InformationLoading label="report details" />
        ) : unit.isError ? (
          <ReadError
            message="We couldn’t confirm your unit. Retry to view this report."
            retry={() => void unit.refetch()}
            busy={unit.isFetching}
          />
        ) : !placement ? (
          <p role="alert" className="text-sm leading-6 text-muted-foreground">
            No unit assigned. Please contact your property administrator.
          </p>
        ) : actor ? (
          <ReportDetails
            key={`${actor.id}:${placement.id}:${reportId}`}
            actorId={actor.id}
            unitId={placement.id}
            reportId={reportId}
          />
        ) : null}
      </div>
    </div>
  )
}

function ReportDetails({
  actorId,
  unitId,
  reportId,
}: {
  actorId: string
  unitId: string
  reportId: string
}) {
  const query = useQuery(
    residentReportDetailQueryOptions(actorId, unitId, reportId),
  )
  const inaccessible =
    (query.error instanceof ApiError &&
      (query.error.statusCode === 403 || query.error.statusCode === 404)) ||
    (!!query.data && query.data.unit.id !== unitId)

  if (query.isPending) return <InformationLoading label="report details" />
  if (inaccessible)
    return (
      <p role="alert" className="text-sm leading-6 text-muted-foreground">
        This report is unavailable. Return home to choose an available report.
      </p>
    )

  const report = query.data
  return (
    <div aria-busy={query.isFetching}>
      {query.error && (
        <ReadError
          message={
            report
              ? 'We couldn’t refresh this report. Showing the last available information.'
              : 'We couldn’t load this report.'
          }
          retry={() => void query.refetch()}
          busy={query.isFetching}
        />
      )}
      {query.isFetching && (
        <p role="status" className="sr-only">
          Updating report details
        </p>
      )}
      {report && <ReportContent report={report} />}
    </div>
  )
}

const tabs = ['Overview', 'Progress', 'Work'] as const
const categoryIcons = {
  AC: AirVent,
  ELECTRICAL: Zap,
  PLUMBING: Droplets,
  FURNITURE: Armchair,
  BUILDING: Building2,
  OTHER: Shapes,
}

function ReportContent({ report }: { report: ReportDetail }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Overview')
  const Icon = categoryIcons[report.category]
  const assignment = report.assignment
  const result = report.maintenanceResult

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    setTab(tabs[next])
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role=tab]')
      [next]?.focus()
  }

  return (
    <>
      <section
        aria-label="Report status"
        className={`rounded-2xl p-5 ${residentReportStatusStyles[report.status]}`}
      >
        <p className="text-sm">Report status</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          {reportStatusLabels[report.status]}
        </p>
        <p className="mt-3 text-sm leading-6">
          {residentReportStatusHelp[report.status]}
        </p>
      </section>
      <section aria-label="Report overview" className="py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {reportCategoryLabels[report.category]}
          </span>
          <span className="shrink-0">
            <span className="sr-only">Priority: </span>
            <ReportPriorityBadge
              priority={report.finalPriority ?? report.proposedPriority}
            />
          </span>
        </div>
        <h2 className="text-2xl leading-8 font-semibold tracking-tight wrap-anywhere">
          {report.title}
        </h2>
      </section>
      <div
        role="tablist"
        aria-label="Report detail sections"
        className="grid grid-cols-3 border-b"
      >
        {tabs.map((name, index) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`resident-report-tab-${name}`}
            aria-controls="resident-report-panel"
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => handleTabKey(event, index)}
            className={`min-h-12 border-b-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${tab === name ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="resident-report-panel"
        aria-labelledby={`resident-report-tab-${tab}`}
        tabIndex={0}
        className="space-y-6 pt-6 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {tab === 'Overview' && (
          <>
            <RejectionReason report={report} />
            <section aria-label="Description">
              <h2 className="mb-3 text-base font-semibold">What happened</h2>
              <p className="whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
                {report.description}
              </p>
            </section>
            <section aria-labelledby="damage-photos-heading">
              <h2
                id="damage-photos-heading"
                className="mb-3 text-base font-semibold"
              >
                Damage photos
              </h2>
              {report.damagePhotos.length ? (
                <ReportPhotos
                  photos={report.damagePhotos}
                  label="Damage photos"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No damage photos
                </p>
              )}
            </section>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-5">
              <DetailField label="Report number">
                {report.reportNumber}
              </DetailField>
              <DetailField label="Unit / Floor">
                {report.unit.unitNumber} / {report.unit.floor}
              </DetailField>
              <DetailField label="Reported">
                {formatDate(report.reportedAt)}
              </DetailField>
              {report.closedAt && (
                <DetailField label="Closed">
                  {formatDate(report.closedAt)}
                </DetailField>
              )}
            </dl>
          </>
        )}
        {tab === 'Progress' && (
          <>
            <ResidentReportProgress report={report} />
            <RejectionReason report={report} />
          </>
        )}
        {tab === 'Work' && (
          <>
            {assignment ? (
              <section
                aria-label="Your technician"
                className="rounded-2xl border p-4.5"
              >
                <h2 className="mb-4 text-base font-semibold">
                  Your technician
                </h2>
                <div className="flex gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
                    aria-hidden="true"
                  >
                    <UserRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold wrap-anywhere">
                      {assignment.technician?.name ?? 'Not provided yet'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground wrap-anywhere">
                      Assigned {formatDate(assignment.assignedAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 text-sm leading-6">
                  <Clock3
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Estimated arrival
                    </p>
                    <p className="font-medium wrap-anywhere">
                      {assignment.estimatedArrivalAt
                        ? formatDate(assignment.estimatedArrivalAt)
                        : 'Not provided yet'}
                    </p>
                  </div>
                </div>
                {assignment.note && (
                  <p className="mt-4 border-t pt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground wrap-anywhere">
                    {assignment.note}
                  </p>
                )}
              </section>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                A technician hasn’t been assigned yet.
              </p>
            )}
            <section
              aria-labelledby="work-result-heading"
              className="space-y-5 border-t pt-6"
            >
              <h2 id="work-result-heading" className="text-base font-semibold">
                Work result
              </h2>
              {result ? (
                <dl className="space-y-4">
                  <DetailField label="Inspection">
                    {result.inspectionResult}
                  </DetailField>
                  <DetailField label="Problem found">
                    {result.problemFound}
                  </DetailField>
                  <DetailField label="Repair action">
                    {result.repairAction}
                  </DetailField>
                  {result.additionalNotes && (
                    <DetailField label="Additional notes">
                      {result.additionalNotes}
                    </DetailField>
                  )}
                </dl>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Work results will appear here when they’re available.
                </p>
              )}
              {report.repairPhotos.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium">Repair photos</h3>
                  <ReportPhotos
                    photos={report.repairPhotos}
                    label="Repair photos"
                  />
                </div>
              )}
              {(result ||
                report.status === 'COMPLETED' ||
                report.status === 'CLOSED') && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
                  <span className="text-sm text-muted-foreground">
                    Total cost (IDR)
                  </span>
                  <strong className="text-lg tabular-nums wrap-anywhere">
                    {formatIdr(report.totalCost)}
                  </strong>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}

function RejectionReason({ report }: { report: ReportDetail }) {
  if (!report.rejectionReason) return null
  return (
    <section
      aria-label="Rejection reason"
      className="rounded-xl bg-destructive/10 p-4 text-destructive-text"
    >
      <h2 className="text-sm font-semibold">Rejection reason</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
        {report.rejectionReason}
      </p>
    </section>
  )
}

function DetailField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
        {children}
      </dd>
    </div>
  )
}
