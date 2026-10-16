import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ClipboardList, Home, Plus } from 'lucide-react'
import { ProtectedPortal } from '@/features/auth/components/protected-portal'
import { ResidentReportProvider } from '@/features/resident/resident-report-sheet'
import { useResidentReport } from '@/features/resident/resident-report-context'

export function ResidentLayout() {
  return (
    <ProtectedPortal role="RESIDENT">
      {(actor) => (
        <ResidentReportProvider key={actor.id} actorId={actor.id}>
          <ResidentShell />
        </ResidentReportProvider>
      )}
    </ProtectedPortal>
  )
}

function ResidentShell() {
  const { canReport, hasUnit, openReport } = useResidentReport()
  const isHome = useLocation({
    select: (location) => location.pathname === '/',
  })
  const isReports = useLocation({
    select: (location) => location.pathname.startsWith('/reports'),
  })
  return (
    <div className="min-h-svh bg-muted">
      <div className="mx-auto min-h-svh w-full max-w-107.5 bg-background">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <main
          id="main-content"
          tabIndex={-1}
          className="pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none"
        >
          <Outlet />
        </main>
        <nav
          aria-label="Resident navigation"
          className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-107.5 -translate-x-1/2 grid-cols-3 border-t bg-background px-3 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))]"
        >
          <Link
            to="/"
            aria-current={isHome ? 'page' : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span
              className={
                isHome ? 'rounded-lg bg-accent px-4 py-1' : 'px-4 py-1'
              }
            >
              <Home aria-hidden="true" className="size-5" />
            </span>
            Home
          </Link>
          {hasUnit ? (
            <button
              type="button"
              disabled={!canReport}
              onClick={(event) => openReport(event.currentTarget)}
              aria-label="Report"
              className="relative flex min-h-14 flex-col items-center justify-end rounded-lg pb-1 text-xs text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="absolute -top-8 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                <Plus aria-hidden="true" className="size-6" />
              </span>
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <Link
            to="/reports"
            search={{ view: 'ongoing', page: 1 }}
            aria-current={isReports ? 'page' : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span
              className={
                isReports ? 'rounded-lg bg-accent px-4 py-1' : 'px-4 py-1'
              }
            >
              <ClipboardList aria-hidden="true" className="size-5" />
            </span>
            Reports
          </Link>
        </nav>
      </div>
    </div>
  )
}
