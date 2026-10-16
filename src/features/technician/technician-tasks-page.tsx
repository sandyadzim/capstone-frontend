import { useCallback, useRef, type KeyboardEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { ApiError } from '@/lib/api/error'
import { ReadError } from '@/components/read-feedback'
import { technicianTaskListQueryOptions } from './technician-queries'
import { TechnicianTaskCard } from './technician-task-card'
import type { TechnicianTasksSearch } from './technician-tasks-search'

const views = ['ongoing', 'history'] as const

export function TechnicianTasksPage() {
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  const search = useSearch({ from: '/technician/tasks' })
  const navigate = useNavigate({ from: '/technician/tasks' })
  const heading = useRef<HTMLHeadingElement>(null)

  function changeView(view: TechnicianTasksSearch['view']) {
    void navigate({ search: { view, page: 1 } })
  }

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      next = 1 - index
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else return
    event.preventDefault()
    changeView(views[next])
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role=tab]')
      [next]?.focus()
  }

  const correctPage = useCallback(
    (page: number) => {
      void navigate({ search: { view: search.view, page }, replace: true })
    },
    [navigate, search.view],
  )

  function changePage(page: number) {
    void navigate({ search: { view: search.view, page } }).then(() => {
      heading.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }

  return (
    <div className="min-w-0 px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
      <header>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          Tasks
        </h1>
      </header>
      <div
        role="tablist"
        aria-label="Task views"
        className="mt-6 flex border-b"
      >
        {views.map((view, index) => (
          <button
            key={view}
            id={`tasks-${view}-tab`}
            type="button"
            role="tab"
            aria-selected={search.view === view}
            aria-controls="tasks-panel"
            tabIndex={search.view === view ? 0 : -1}
            onClick={() => changeView(view)}
            onKeyDown={(event) => handleTabKey(event, index)}
            className={`min-h-12 flex-1 border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${search.view === view ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {view === 'ongoing' ? 'Ongoing' : 'History'}
          </button>
        ))}
      </div>
      <section
        id="tasks-panel"
        role="tabpanel"
        aria-labelledby={`tasks-${search.view}-tab`}
        tabIndex={0}
        className="pt-6 outline-none focus-visible:outline-2 focus-visible:outline-ring"
      >
        {actor?.role === 'TECHNICIAN' && (
          <TaskList
            key={actor.id}
            actorId={actor.id}
            search={search}
            changePage={changePage}
            correctPage={correctPage}
          />
        )}
      </section>
    </div>
  )
}

function TaskList({
  actorId,
  search,
  changePage,
  correctPage,
}: {
  actorId: string
  search: TechnicianTasksSearch
  changePage: (page: number) => void
  correctPage: (page: number) => void
}) {
  const query = useQuery(technicianTaskListQueryOptions(actorId, search))
  const unavailable =
    query.error instanceof ApiError &&
    (query.error.statusCode === 403 || query.error.statusCode === 404)
  usePageCorrection(
    unavailable || query.isError ? undefined : query.data?.meta,
    search.page,
    correctPage,
  )

  if (unavailable)
    return (
      <ReadError
        message="Your tasks are unavailable. Retry to check access again."
        retry={() => void query.refetch()}
        busy={query.isFetching}
      />
    )
  if (
    query.isPending ||
    (!query.isError &&
      query.data &&
      search.page > Math.max(1, query.data.meta.totalPages))
  )
    return <TasksLoading />

  const records = query.data?.data
  const meta = query.data?.meta
  return (
    <div aria-busy={query.isFetching}>
      {query.isError && (
        <ReadError
          message={
            records
              ? 'We couldn’t refresh your tasks. Showing the last available information.'
              : 'We couldn’t load your tasks.'
          }
          retry={() => void query.refetch()}
          busy={query.isFetching}
        />
      )}
      {query.isFetching && (
        <p role="status" className="sr-only">
          Updating tasks
        </p>
      )}
      {records &&
        (records.length ? (
          <ul
            aria-label={
              search.view === 'ongoing' ? 'Ongoing tasks' : 'Task history'
            }
            className="space-y-4.25"
          >
            {records.map((report) => (
              <TechnicianTaskCard
                key={report.id}
                report={report}
                source={search}
              />
            ))}
          </ul>
        ) : (
          <div className="mx-auto max-w-64 py-12 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground">
              <ClipboardList aria-hidden="true" className="size-7" />
            </div>
            <h2 className="text-base font-medium">
              {search.view === 'ongoing'
                ? 'No ongoing tasks'
                : 'No task history'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {search.view === 'ongoing'
                ? 'Your assigned work stays here until your administrator closes it.'
                : 'Tasks closed by your administrator will appear here.'}
            </p>
          </div>
        ))}
      {!!records?.length && meta && (
        <nav
          aria-label="Task pagination"
          className="mt-6 flex items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            className="size-11"
            disabled={search.page <= 1}
            onClick={() => changePage(search.page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span
            aria-current="page"
            aria-label={`Current page ${search.page}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground"
          >
            {search.page}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            className="size-11"
            disabled={search.page >= meta.totalPages}
            onClick={() => changePage(search.page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}

function TasksLoading() {
  return (
    <div
      role="status"
      aria-label="Loading tasks"
      aria-busy="true"
      className="space-y-4.25"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="space-y-4 rounded-2xl border bg-card p-4.5"
        >
          <Skeleton className="h-11 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}
