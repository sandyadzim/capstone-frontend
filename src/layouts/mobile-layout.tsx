import { Link, Outlet } from '@tanstack/react-router'
import { Brand } from '@/components/brand'
import { PortalNav } from '@/components/portal-nav'
import { ThemeMenu } from '@/components/theme-menu'
import { Badge } from '@/components/ui/badge'
import { portals, type PortalId } from './portals'

export function MobileLayout({
  portal,
}: {
  portal: Exclude<PortalId, 'admin'>
}) {
  const config = portals[portal]

  return (
    <div className="mobile-shell mx-auto flex min-h-svh w-full max-w-lg flex-col border-x border-border bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="flex items-center justify-between border-b px-5 py-3">
        <Link
          to={config.home}
          aria-label={`${config.name} home`}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{config.name}</Badge>
          <ThemeMenu />
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mobile-content flex-1 px-5 py-8 outline-none"
      >
        <Outlet />
      </main>
      <footer className="mobile-nav fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg border-t bg-background px-4 pt-2">
        <PortalNav portal={portal} mobile />
      </footer>
    </div>
  )
}

export function ResidentLayout() {
  return <MobileLayout portal="resident" />
}
export function TechnicianLayout() {
  return <MobileLayout portal="technician" />
}
