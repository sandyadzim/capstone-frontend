import { ProtectedPortal } from '@/features/auth/components/protected-portal'
import { AccountMenu } from '@/features/auth/components/account-menu'
import { useState } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Menu, PanelLeft } from 'lucide-react'
import { AdminSidebar } from '@/features/admin/components/admin-sidebar'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import { adminPageTitle } from '@/features/admin/admin-navigation'
import { ThemeMenu } from '@/components/theme-menu'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const collapsed = useAdminUiStore((state) => state.collapsed)
  const toggleSidebar = useAdminUiStore((state) => state.toggleSidebar)
  const location = useRouterState({ select: (state) => state.location })

  return (
    <ProtectedPortal role="ADMIN">
      {(actor) => (
        <div className="admin-shell min-h-svh" data-collapsed={collapsed}>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <aside
            aria-label="Admin sidebar"
            className="admin-sidebar fixed inset-y-0 left-0 z-20 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block"
          >
            <AdminSidebar collapsed={collapsed} />
          </aside>
          <div className="admin-body">
            <header className="admin-header fixed inset-x-0 top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b bg-card px-4 pt-[env(safe-area-inset-top)] md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="size-11 md:hidden"
                        size="icon"
                        aria-label="Open navigation"
                      />
                    }
                  >
                    <Menu aria-hidden="true" />
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-72 bg-sidebar text-sidebar-foreground [&>button]:text-sidebar-foreground [&>button:hover]:bg-sidebar-accent"
                  >
                    <SheetHeader className="sr-only">
                      <SheetTitle>Admin navigation</SheetTitle>
                      <SheetDescription>
                        Navigate the admin workspace.
                      </SheetDescription>
                    </SheetHeader>
                    <AdminSidebar onNavigate={() => setOpen(false)} />
                  </SheetContent>
                </Sheet>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-11 md:inline-flex"
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-pressed={collapsed}
                  onClick={toggleSidebar}
                >
                  <PanelLeft aria-hidden="true" />
                </Button>
                <span
                  className="truncate text-sm font-medium"
                  title={adminPageTitle(
                    location.pathname,
                    location.search.role,
                  )}
                >
                  {adminPageTitle(location.pathname, location.search.role)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 md:gap-3">
                <ThemeMenu />
                <AccountMenu actor={actor} />
              </div>
            </header>
            <main
              id="main-content"
              tabIndex={-1}
              className="w-full max-w-5xl scroll-mt-[calc(5rem+env(safe-area-inset-top))] px-4 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none md:px-6 md:pb-8 [&_:is(input,textarea,button,a)]:scroll-mt-[calc(5rem+env(safe-area-inset-top))]"
            >
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </ProtectedPortal>
  )
}
