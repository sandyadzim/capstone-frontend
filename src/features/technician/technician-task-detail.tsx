import { useRef, useState, type KeyboardEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Building2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { InformationLoading, ReadError } from '@/components/read-feedback'
import {
  ReportPriorityBadge,
  ReportStatusBadge,
} from '@/features/admin/reports/components/report-badges'
import { ReportPhotos } from '@/features/admin/reports/components/report-photos'
import { reportCategoryLabels } from '@/features/admin/reports/report-labels'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { ApiError } from '@/lib/api/error'
import { formatDate } from '@/lib/format'
import { technicianTaskDetailQueryOptions } from './technician-queries'
import { TechnicianWorkResult } from './technician-work-result'
import { StartWorkSheet } from './start-work-sheet'

export function TechnicianTaskDetail() {
  const { reportId } = useParams({ from: '/technician/tasks/$reportId' })
  const source = useSearch({ from: '/technician/tasks/$reportId' })
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  return (
    <div className="technician-task-detail min-w-0">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background px-5 pt-[calc(.75rem+env(safe-area-inset-top))] pb-4">
        <Button
          nativeButton={false}
          role="link"
          variant="ghost"
          size="icon"
          className="size-11"
          render={
            <Link
              to={source.from === 'tasks' ? '/technician/tasks' : '/technician'}
              search={
                source.from === 'tasks'
                  ? { view: source.view, page: source.page }
                  : {}
              }
              activeOptions={{ exact: true }}
              aria-label={
                source.from === 'tasks' ? 'Back to tasks' : 'Back to home'
              }
            />
          }
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Task details</h1>
      </header>
      <div className="space-y-6 px-5 pb-8">
        {!z.uuid().safeParse(reportId).success ? (
          <p role="alert" className="text-sm leading-6 text-destructive-text">
            Invalid report ID. Return home to choose a task.
          </p>
        ) : actor?.role === 'TECHNICIAN' ? (
          <TaskDetails
            key={`${actor.id}:${reportId}`}
            actorId={actor.id}
            reportId={reportId}
          />
        ) : null}
      </div>
    </div>
  )
}

function TaskDetails({
  actorId,
  reportId,
}: {
  actorId: string
  reportId: string
}) {
  const source = useSearch({ from: '/technician/tasks/$reportId' })
  const query = useQuery(technicianTaskDetailQueryOptions(actorId, reportId))
  const [accessLost, setAccessLost] = useState(false)
  const [tab, setTab] = useState<'overview' | 'result'>('overview')
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 'overview'
        : event.key === 'End'
          ? 'result'
          : tab === 'overview'
            ? 'result'
            : 'overview'
    setTab(next)
    document.getElementById(`technician-task-tab-${next}`)?.focus()
  }
  const heading = useRef<HTMLHeadingElement>(null)
  const report = query.data
  const inaccessible =
    accessLost ||
    (query.error instanceof ApiError &&
      [403, 404].includes(query.error.statusCode ?? 0)) ||
    (!!report?.assignment?.technician &&
      report.assignment.technician.id !== actorId)

  if (query.isPending) return <InformationLoading label="task details" />
  if (inaccessible)
    return (
      <ReadError
        message="This task is unavailable. Return home to choose an available task."
        busy={query.isFetching}
        retry={() => {
          void query.refetch().then((result) => {
            if (result.isSuccess) setAccessLost(false)
          })
        }}
      />
    )

  return (
    <div className="space-y-6" aria-busy={query.isFetching}>
      {query.error && (
        <ReadError
          message={
            report
              ? 'We couldn’t refresh this task. Showing the last available information.'
              : 'We couldn’t load this task.'
          }
          retry={() => void query.refetch()}
          busy={query.isFetching}
        />
      )}
      {query.isFetching && (
        <p role="status" className="sr-only">
          Updating task details
        </p>
      )}
      {report && (
        <>
          <section
            aria-label="Task location"
            className="rounded-2xl bg-sidebar p-5 text-sidebar-foreground"
          >
            <div className="flex items-center gap-3">
              <Building2
                aria-hidden="true"
                className="size-6 shrink-0 text-sidebar-primary"
              />
              <div className="min-w-0">
                <h2 className="text-2xl font-medium tracking-tight wrap-anywhere">
                  Unit {report.unit.unitNumber}
                </h2>
                <p className="mt-1 text-sm text-sidebar-muted-foreground">
                  Floor {report.unit.floor}
                </p>
              </div>
            </div>
            {report.assignment?.note && (
              <div className="mt-5 border-t border-sidebar-border pt-4">
                <h3 className="text-sm font-medium">Assignment note</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-sidebar-muted-foreground wrap-anywhere">
                  {report.assignment.note}
                </p>
              </div>
            )}
          </section>
          <section aria-label="Report information">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {reportCategoryLabels[report.category]}
              </span>
              <span>
                <span className="sr-only">Priority: </span>
                <ReportPriorityBadge
                  priority={report.finalPriority ?? report.proposedPriority}
                />
              </span>
            </div>
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-2xl leading-8 font-semibold tracking-tight wrap-anywhere outline-none"
            >
              {report.title}
            </h2>
            <div className="mt-3">
              <span className="sr-only">Status: </span>
              <ReportStatusBadge status={report.status} />
            </div>
            {report.assignment?.estimatedArrivalAt && (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Estimated arrival:{' '}
                {formatDate(report.assignment.estimatedArrivalAt)} WIB
              </p>
            )}
          </section>
          <div
            role="tablist"
            aria-label="Task detail sections"
            className="grid grid-cols-2 border-b"
          >
            {(['overview', 'result'] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`technician-task-tab-${name}`}
                aria-controls="technician-task-panel"
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={handleTabKey}
                className={`min-h-12 border-b-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${tab === name ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {name === 'overview' ? 'Overview' : 'Work Result'}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="technician-task-panel"
            aria-labelledby={`technician-task-tab-${tab}`}
            tabIndex={0}
            className="space-y-6 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {tab === 'result' ? (
              <TechnicianWorkResult report={report} />
            ) : (
              <>
                <StartWorkSheet
                  actorId={actorId}
                  report={report}
                  disabled={query.isFetching || query.isError}
                  heading={heading}
                  refresh={() => query.refetch()}
                  onAccessLost={() => {
                    setAccessLost(true)
                    void query.refetch()
                  }}
                />
                {report.status === 'IN_PROGRESS' &&
                  report.assignment?.technician?.id === actorId && (
                    <Button
                      nativeButton={false}
                      role="link"
                      className="min-h-11 w-full"
                      disabled={query.isFetching || query.isError}
                      render={
                        <Link
                          to="/technician/tasks/$reportId/complete"
                          params={{ reportId }}
                          search={source}
                        />
                      }
                    >
                      Complete task
                    </Button>
                  )}
                {['COMPLETED', 'CLOSED'].includes(report.status) && (
                  <section
                    className="rounded-xl bg-muted/60 p-4"
                    aria-label="Completion summary"
                  >
                    <h2 className="text-base font-semibold">Task completed</h2>
                    {report.status === 'COMPLETED' && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Your work is awaiting administrator review.
                      </p>
                    )}
                  </section>
                )}
                {report.rejectionReason && (
                  <section
                    aria-label="Rejection reason"
                    className="rounded-xl bg-destructive/10 p-4 text-destructive-text"
                  >
                    <h2 className="text-sm font-semibold">Rejection reason</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
                      {report.rejectionReason}
                    </p>
                  </section>
                )}
                <section aria-label="Description" className="border-t pt-6">
                  <h2 className="mb-3 text-base font-semibold">
                    What happened
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
                    {report.description}
                  </p>
                </section>
                <section aria-labelledby="task-damage-photos-heading">
                  <h2
                    id="task-damage-photos-heading"
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
                <dl className="profile-information border-t pt-5">
                  <div>
                    <dt>Report number</dt>
                    <dd>{report.reportNumber}</dd>
                  </div>
                  <div>
                    <dt>Reported</dt>
                    <dd>{formatDate(report.reportedAt)} WIB</dd>
                  </div>
                  {report.closedAt && (
                    <div>
                      <dt>Closed</dt>
                      <dd>{formatDate(report.closedAt)} WIB</dd>
                    </div>
                  )}
                </dl>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
