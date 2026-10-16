import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ClipboardList, Home } from 'lucide-react'
import { ProtectedPortal } from '@/features/auth/components/protected-portal'

export function TechnicianLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const isHome = pathname.replace(/\/$/, '') === '/technician'
  const isTasks = pathname.startsWith('/technician/tasks')
  return (
    <ProtectedPortal role="TECHNICIAN">
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
              aria-label="Technician navigation"
              className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-107.5 -translate-x-1/2 grid-cols-2 border-t bg-background px-3 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))]"
            >
              <Link
                to="/technician"
                activeOptions={{ exact: true }}
                aria-current={isHome ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs focus-visible:outline-2 focus-visible:outline-ring ${isHome ? 'text-primary' : 'text-muted-foreground'}`}
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
              <Link
                to="/technician/tasks"
                search={{ view: 'ongoing', page: 1 }}
                aria-current={isTasks ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs focus-visible:outline-2 focus-visible:outline-ring ${isTasks ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <span
                  className={
                    isTasks ? 'rounded-lg bg-accent px-4 py-1' : 'px-4 py-1'
                  }
                >
                  <ClipboardList aria-hidden="true" className="size-5" />
                </span>
                Tasks
              </Link>
            </nav>
          </div>
        </div>
      )}
    </ProtectedPortal>
  )
}
