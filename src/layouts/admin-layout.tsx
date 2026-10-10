import { ProtectedPortal } from '@/features/auth/components/protected-portal'
import { AccountMenu } from '@/features/auth/components/account-menu'
import { useState } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { Brand } from '@/components/brand'
import { PortalNav } from '@/components/portal-nav'
import { ThemeMenu } from '@/components/theme-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col p-5">
      <Link
        to="/admin"
        aria-label="Admin home"
        onClick={onNavigate}
        className="w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <Brand />
      </Link>
      <div className="mt-10">
        <PortalNav portal="admin" onNavigate={onNavigate} />
      </div>
      <p className="mt-auto pt-8 text-xs text-muted-foreground">
        Property management
      </p>
    </div>
  )
}

export function AdminLayout() {
  const [open, setOpen] = useState(false)

  return (
    <ProtectedPortal role="ADMIN">
      {(actor) => (
        <div className="min-h-svh">
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <aside
            aria-label="Admin sidebar"
            className="fixed inset-y-0 left-0 hidden w-60 border-r bg-sidebar md:block"
          >
            <Sidebar />
          </aside>
          <div className="md:pl-60">
            <header className="flex min-h-18 items-center justify-between gap-3 border-b px-5 md:px-8">
              <div className="flex items-center gap-3">
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
                  <SheetContent side="left" className="w-72 bg-sidebar">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Admin navigation</SheetTitle>
                      <SheetDescription>
                        Navigate the admin workspace.
                      </SheetDescription>
                    </SheetHeader>
                    <Sidebar onNavigate={() => setOpen(false)} />
                  </SheetContent>
                </Sheet>
                <span className="text-sm font-medium">Admin workspace</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">Starter</Badge>
                <ThemeMenu />
                <AccountMenu actor={actor} />
              </div>
            </header>
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto max-w-5xl px-5 py-8 outline-none md:px-8 md:py-12"
            >
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </ProtectedPortal>
  )
}
