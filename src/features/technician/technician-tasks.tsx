import { useQuery } from '@tanstack/react-query'
import { Wrench } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReadError } from '@/components/read-feedback'
import { ApiError } from '@/lib/api/error'
import { TechnicianTaskCard } from './technician-task-card'
import { technicianTasksQueryOptions } from './technician-queries'

export function TechnicianTasks({ actorId }: { actorId: string }) {
  const tasks = useQuery(technicianTasksQueryOptions(actorId))
  const accessDenied =
    tasks.error instanceof ApiError &&
    (tasks.error.statusCode === 403 || tasks.error.statusCode === 404)

  if (tasks.isPending)
    return (
      <div
        role="status"
        aria-label="Loading ongoing tasks"
        aria-busy="true"
        className="mt-5 space-y-4"
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="space-y-4 rounded-2xl border bg-card p-4.5"
          >
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    )

  return (
    <div aria-busy={tasks.isFetching}>
      {tasks.data &&
        !accessDenied &&
        (tasks.data.data.length ? (
          <>
            <ul aria-label="Ongoing tasks" className="mt-5 space-y-4">
              {tasks.data.data.slice(0, 10).map((report) => (
                <TechnicianTaskCard key={report.id} report={report} />
              ))}
            </ul>
            {tasks.data.meta.total > 10 && (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Showing the latest 10 ongoing tasks.
              </p>
            )}
          </>
        ) : (
          <div className="py-12 text-center">
            <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Wrench aria-hidden="true" className="size-7" />
            </span>
            <h3 className="text-xl font-medium tracking-tight">
              No ongoing tasks
            </h3>
            <p className="mx-auto mt-3 max-w-64 text-sm leading-6 text-muted-foreground">
              Your assigned tasks will appear here.
            </p>
          </div>
        ))}
      {tasks.isFetching && (
        <p role="status" className="sr-only">
          Updating ongoing tasks
        </p>
      )}
      {tasks.isError && (
        <ReadError
          message={
            accessDenied
              ? 'Your tasks are unavailable. Try again or contact your property administrator.'
              : tasks.data
                ? 'We couldn’t refresh your ongoing tasks.'
                : 'We couldn’t load your ongoing tasks.'
          }
          retry={() => {
            void tasks.refetch()
          }}
          busy={tasks.isFetching}
        />
      )}
    </div>
  )
}
