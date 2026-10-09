import { Link } from '@tanstack/react-router'
import { ClipboardPenLine, House } from 'lucide-react'
import { cn } from '@/lib/utils'
import { portals, type PortalId } from '@/layouts/portals'

export function PortalNav({
  portal,
  mobile = false,
  onNavigate,
}: {
  portal: PortalId
  mobile?: boolean
  onNavigate?: () => void
}) {
  const config = portals[portal]
  const items = [
    {
      to: config.home,
      label: portal === 'admin' ? 'Overview' : 'Home',
      icon: House,
    },
    { to: config.example, label: 'Example form', icon: ClipboardPenLine },
  ]

  return (
    <nav
      aria-label={`${config.name} navigation`}
      className={cn(mobile ? 'grid grid-cols-2 gap-2' : 'space-y-1')}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          activeProps={{
            className: 'bg-accent text-accent-foreground',
            'aria-current': 'page',
          }}
          inactiveProps={{ className: 'text-muted-foreground' }}
          onClick={onNavigate}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            mobile && 'min-h-14 flex-col justify-center gap-1 px-2 text-xs',
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
