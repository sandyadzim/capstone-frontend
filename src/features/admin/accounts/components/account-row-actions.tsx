import { Link } from '@tanstack/react-router'
import { Ellipsis, Eye, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Account, AccountsSearch } from '../account-schema'

export function AccountRowActions({
  account,
  search,
}: {
  account: Account
  search: AccountsSearch
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Actions for ${account.name}`}
            title={`Actions for ${account.name}`}
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        aria-label={`Actions for ${account.name}`}
      >
        <DropdownMenuItem
          className="min-h-11 gap-3 px-3"
          render={
            <Link
              to="/admin/accounts/$accountId"
              params={{ accountId: account.id }}
              search={search}
            />
          }
        >
          <Eye aria-hidden="true" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11 gap-3 px-3"
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
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
