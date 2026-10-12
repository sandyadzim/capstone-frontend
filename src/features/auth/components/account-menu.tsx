import { useState } from 'react'
import type { ReactNode } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Actor } from '../auth-schema'
import { useSignOut } from '../hooks/use-sign-out'
import { cn } from '@/lib/utils'

export function AccountMenu({
  actor,
  trigger,
  className,
}: {
  actor: Actor
  trigger?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const logout = useSignOut()
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-11', className)}
            aria-label={`Account menu for ${actor.name}`}
          />
        }
      >
        {trigger ?? <UserRound aria-hidden="true" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-3">
            <span className="block wrap-anywhere text-sm font-medium text-foreground">
              {actor.name}
            </span>
            <span className="mt-1 block capitalize">
              {actor.role.toLowerCase()}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 px-3"
            closeOnClick={false}
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut aria-hidden="true" />{' '}
            {logout.isPending
              ? 'Signing out…'
              : logout.isError
                ? 'Try signing out again'
                : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
