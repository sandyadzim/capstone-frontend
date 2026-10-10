import { Link } from '@tanstack/react-router'
import { Ellipsis, Eye, Pencil, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Unit, UnitsSearch } from '../unit-schema'

export function UnitRowActions({
  unit,
  search,
}: {
  unit: Unit
  search: UnitsSearch
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
            aria-label={`Actions for ${unit.unitNumber}`}
            title={`Actions for ${unit.unitNumber}`}
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        aria-label={`Actions for ${unit.unitNumber}`}
      >
        <DropdownMenuItem
          className="min-h-11 gap-3 px-3"
          render={
            <Link
              to="/admin/units/$unitId"
              params={{ unitId: unit.id }}
              search={search}
            />
          }
        >
          <Eye aria-hidden="true" /> View
        </DropdownMenuItem>
        {!unit.isArchived && (
          <>
            <DropdownMenuItem
              className="min-h-11 gap-3 px-3"
              render={
                <Link
                  to="/admin/units/$unitId/edit"
                  params={{ unitId: unit.id }}
                  search={search}
                />
              }
            >
              <Pencil aria-hidden="true" /> Edit
            </DropdownMenuItem>
            {!unit.activeResident && (
              <DropdownMenuItem
                className="min-h-11 gap-3 px-3"
                render={
                  <Link
                    to="/admin/units/$unitId/resident"
                    params={{ unitId: unit.id }}
                    search={search}
                  />
                }
              >
                <UserPlus aria-hidden="true" /> Place resident
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
