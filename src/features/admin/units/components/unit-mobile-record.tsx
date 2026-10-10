import { Link } from '@tanstack/react-router'
import type { Unit, UnitsSearch } from '../unit-schema'
import { UnitArchivedBadge, UnitStatusBadge } from './unit-page'
import { UnitRowActions } from './unit-row-actions'

export function UnitMobileRecord({
  unit,
  search,
}: {
  unit: Unit
  search: UnitsSearch
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/admin/units/$unitId"
          params={{ unitId: unit.id }}
          search={search}
          aria-label={`Unit ${unit.unitNumber}`}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring wrap-anywhere"
        >
          {unit.unitNumber}
        </Link>
        <div className="shrink-0">
          <UnitRowActions unit={unit} search={search} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Floor</dt>
          <dd className="mt-1">{unit.floor}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Archived</dt>
          <dd className="mt-1">
            <UnitArchivedBadge archived={unit.isArchived} />
          </dd>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-3">
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd>
            <UnitStatusBadge status={unit.displayStatus} />
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted-foreground">Resident</dt>
          <dd className="mt-1 wrap-anywhere">
            {unit.activeResident?.name ?? 'No resident'}
          </dd>
        </div>
      </dl>
    </>
  )
}
