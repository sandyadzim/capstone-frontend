import type { ReactNode, Ref } from 'react'
import { Link } from '@tanstack/react-router'
import { Archive, ChevronDown, History, Pencil, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Unit, UnitsSearch } from '../unit-schema'

export function UnitDetailActions({
  unit,
  search,
  busy,
  confirmationOpen,
  triggerRef,
  onConfirm,
  placementAction,
}: {
  unit: Unit
  search: UnitsSearch
  busy: boolean
  confirmationOpen: boolean
  triggerRef: Ref<HTMLButtonElement>
  onConfirm: (action: 'release' | 'archive') => void
  placementAction?: ReactNode
}) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
      {unit.isArchived ? (
        <Button
          variant="outline"
          className="min-h-11 px-4"
          nativeButton={false}
          role="link"
          render={
            <Link
              to="/admin/units/$unitId/history"
              params={{ unitId: unit.id }}
              search={search}
            />
          }
        >
          <History aria-hidden="true" /> Maintenance history
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            className="min-h-11 px-4"
            nativeButton={false}
            role="link"
            disabled={busy}
            render={
              <Link
                to="/admin/units/$unitId/edit"
                params={{ unitId: unit.id }}
                search={search}
              />
            }
          >
            <Pencil aria-hidden="true" /> Edit
          </Button>
          <DropdownMenu disabled={busy}>
            <DropdownMenuTrigger
              ref={triggerRef}
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 px-4"
                  disabled={busy}
                />
              }
            >
              Actions <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-56 max-w-(--available-width)"
              aria-label="Unit actions"
              finalFocus={!confirmationOpen}
            >
              <DropdownMenuItem
                className="min-h-11 gap-3 px-3"
                render={
                  <Link
                    to="/admin/units/$unitId/history"
                    params={{ unitId: unit.id }}
                    search={search}
                  />
                }
              >
                <History aria-hidden="true" /> Maintenance history
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="min-h-11 gap-3 px-3 data-[variant=destructive]:text-destructive-text data-[variant=destructive]:focus:text-destructive-text data-[variant=destructive]:*:[svg]:text-destructive-text"
                disabled={busy}
                onClick={() =>
                  onConfirm(unit.activeResident ? 'release' : 'archive')
                }
              >
                {unit.activeResident ? (
                  <UserMinus aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
                {unit.activeResident ? 'Release resident' : 'Archive unit'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {placementAction}
        </>
      )}
    </div>
  )
}
