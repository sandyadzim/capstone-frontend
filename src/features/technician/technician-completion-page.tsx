import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FullScreenLoader } from '@/components/full-screen-loader'
import { InformationLoading, ReadError } from '@/components/read-feedback'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { ApiError } from '@/lib/api/error'
import { CompletionForm } from './completion-form'
import { completionReportSchema } from './completion-schema'
import { technicianTaskDetailQueryOptions } from './technician-queries'
import { useCompleteTask } from './use-complete-task'

export function TechnicianCompletionPage() {
  const { reportId } = useParams({
    from: '/technician/tasks/$reportId_/complete',
  })
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  return (
    <div className="technician-completion min-w-0">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background px-5 pt-[calc(.75rem+env(safe-area-inset-top))] pb-4">
        <Button
          nativeButton={false}
          role="link"
          variant="ghost"
          size="icon"
          className="size-11"
          render={
            <Link
              to="/technician/tasks/$reportId"
              params={{ reportId }}
              aria-label="Back to task"
            />
          }
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Work results</h1>
      </header>
      <div className="space-y-6 px-5 pb-8">
        {!z.uuid().safeParse(reportId).success ? (
          <p role="alert" className="text-sm leading-6 text-destructive-text">
            Invalid report ID. Return to your task to continue.
          </p>
        ) : actor?.role === 'TECHNICIAN' ? (
          <TaskCompletion
            key={`${actor.id}:${reportId}`}
            actorId={actor.id}
            reportId={reportId}
          />
        ) : null}
      </div>
    </div>
  )
}

function TaskCompletion({
  actorId,
  reportId,
}: {
  actorId: string
  reportId: string
}) {
  const completion = useCompleteTask(actorId, reportId)
  const query = useQuery({
    ...technicianTaskDetailQueryOptions(actorId, reportId),
    enabled: !completion.busy,
  })
  const parsed = completionReportSchema.safeParse(query.data)
  const report = parsed.success ? parsed.data : undefined
  const unavailable =
    completion.accessLost ||
    (query.error instanceof ApiError &&
      [403, 404].includes(query.error.statusCode ?? 0)) ||
    (!!query.data && query.data.assignment?.technician?.id !== actorId)
  const incompatible =
    report && report.status !== 'IN_PROGRESS' && !completion.busy
  return (
    <>
      {query.isPending ? (
        <InformationLoading label="work results" />
      ) : unavailable || incompatible ? (
        <p role="alert" className="text-sm leading-6 text-destructive-text">
          This task is unavailable for completion. Return to task details for
          the latest information.
        </p>
      ) : (
        <>
          {(query.isError || !report) && (
            <ReadError
              message={
                report
                  ? 'We couldn’t refresh this task. Retry before completing it.'
                  : 'We couldn’t load the saved work information.'
              }
              retry={() => void query.refetch()}
              busy={query.isFetching}
            />
          )}
          {report && (
            <CompletionForm
              report={report}
              completion={completion}
              disabled={query.isFetching || query.isError}
            />
          )}
        </>
      )}
      <FullScreenLoader
        open={completion.busy}
        message={completion.progress || 'Completing task…'}
      />
    </>
  )
}
