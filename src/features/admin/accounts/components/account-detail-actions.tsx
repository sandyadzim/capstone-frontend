import type { RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Account, AccountsSearch } from '../account-schema'

export function AccountDetailActions({
  account,
  search,
  own,
  busy,
  triggerRef,
  onPassword,
  onStatus,
}: {
  account: Account
  search: AccountsSearch
  own: boolean
  busy: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  onPassword: () => void
  onStatus: () => void
}) {
  return (
    <>
      {own && (
        <p
          id="account-own-access-help"
          className="mt-5 text-sm leading-6 text-muted-foreground"
        >
          You cannot deactivate your own administrator account.
        </p>
      )}
      <div className="-mx-5 -mb-5 mt-5 flex flex-wrap justify-end gap-2 border-t p-4">
        <Button
          nativeButton={false}
          role="link"
          className="min-h-11 px-4"
          disabled={busy}
          render={
            <Link
              to="/admin/accounts/$accountId/edit"
              params={{ accountId: account.id }}
              search={search}
            />
          }
        >
          <Pencil aria-hidden="true" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={busy}
                aria-describedby={own ? 'account-own-access-help' : undefined}
              />
            }
          >
            Actions
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-48"
            aria-label={`Account actions for ${account.name}`}
          >
            <DropdownMenuItem
              className="min-h-11 gap-3 px-3"
              onClick={onPassword}
            >
              <KeyRound aria-hidden="true" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {account.isActive ? (
              <DropdownMenuItem
                disabled={own}
                className="min-h-11 gap-3 px-3 text-destructive-text"
                onClick={onStatus}
              >
                <UserX aria-hidden="true" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="min-h-11 gap-3 px-3"
                onClick={onStatus}
              >
                <UserCheck aria-hidden="true" />
                Activate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
