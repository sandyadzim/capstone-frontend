import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ClipboardList, Home, Plus } from 'lucide-react'
import { ProtectedPortal } from '@/features/auth/components/protected-portal'

export function ResidentLayout() {
  const isHome = useLocation({
    select: (location) => location.pathname === '/',
  })
  return (
    <ProtectedPortal role="RESIDENT">
      {() => (
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
              <button
                type="button"
                disabled
                aria-label="Report"
                className="relative flex min-h-14 flex-col items-center justify-end pb-1 text-xs text-primary"
              >
                <span className="absolute -top-8 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                  <Plus aria-hidden="true" className="size-6" />
                </span>
              </button>
              <button
                type="button"
                disabled
                aria-label="Reports"
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
              >
                <ClipboardList aria-hidden="true" className="size-5" />
                Reports
              </button>
            </nav>
          </div>
        </div>
      )}
    </ProtectedPortal>
  )
}
