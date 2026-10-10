import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Building2,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { accountRoles } from '../admin-navigation'

const linkClass =
  'admin-nav-link relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring'
const accountLinks = [
  { label: 'All accounts', role: undefined },
  ...Object.entries(accountRoles).map(([role, label]) => ({
    label,
    role: role as keyof typeof accountRoles,
  })),
]
const pages = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/reports', label: 'Reports', icon: ClipboardList },
  { to: '/admin/units', label: 'Units', icon: Building2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
] as const

function AccountsNav({
  active,
  role,
  collapsed,
  onNavigate,
}: {
  active: boolean
  role?: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(active)
  if (collapsed)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label="Accounts"
              title="Accounts"
              className={cn(
                linkClass,
                'w-full justify-start px-4',
                active && 'admin-nav-selected',
              )}
            />
          }
        >
          <Users aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-48"
        >
          {accountLinks.map((item) => (
            <DropdownMenuItem
              key={item.label}
              className={cn(
                'min-h-11 px-3',
                active &&
                  role === item.role &&
                  'bg-accent text-accent-foreground',
              )}
              render={
                <Link
                  to="/admin/accounts"
                  search={{ role: item.role }}
                  aria-current={
                    active && role === item.role ? 'page' : undefined
                  }
                  onClick={onNavigate}
                />
              }
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            className={cn(
              linkClass,
              'w-full justify-start',
              active && 'text-sidebar-primary',
            )}
          />
        }
      >
        <Users aria-hidden="true" /> Accounts
        <ChevronDown
          aria-hidden="true"
          className={cn('admin-nav-chevron ml-auto', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="admin-submenu" inert={!open}>
        <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-2 pb-1">
          {accountLinks.map((item) => (
            <Link
              key={item.label}
              to="/admin/accounts"
              search={{ role: item.role }}
              onClick={onNavigate}
              aria-current={active && item.role === role ? 'page' : undefined}
              className={cn(
                linkClass,
                active && item.role === role && 'admin-nav-selected',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AdminNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const location = useRouterState({ select: (state) => state.location })
  const active = location.pathname === '/admin/accounts'
  return (
    <TooltipProvider delay={300}>
      <nav aria-label="Admin navigation" className="space-y-1">
        {pages.map(({ to, label, icon: Icon }, index) => (
          <div key={to}>
            {index === 3 && (
              <AccountsNav
                key={active ? 'accounts' : 'other'}
                active={active}
                role={location.search.role}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )}
            <Tooltip disabled={!collapsed}>
              <TooltipTrigger
                render={
                  <Link
                    to={to}
                    aria-label={label}
                    activeOptions={{ exact: to !== '/admin/units' }}
                    activeProps={{
                      className: 'admin-nav-selected',
                      'aria-current': 'page',
                    }}
                    className={cn(
                      linkClass,
                      collapsed && 'px-4',
                      index === 3 && 'mt-1',
                    )}
                    onClick={onNavigate}
                  />
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                <span className="admin-nav-label" aria-hidden={collapsed}>
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {label}
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </nav>
    </TooltipProvider>
  )
}
