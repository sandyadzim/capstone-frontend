import { getErrorMessage } from '@/lib/api/error'
import { useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { z } from 'zod'
import { toast } from '@/components/ui/toast'
import {
  UnitPage,
  UnitBreadcrumbs,
  UnitReadState,
  UnitStatusBadge,
  UnitArchivedBadge,
  UnitUnavailable,
} from '../components/unit-page'
import { UnitConfirmationDialog } from '../components/unit-confirmation-dialog'
import { UnitDetailActions } from '../components/unit-detail-actions'
import { useUnitNavigation } from '../hooks/use-unit-navigation'
import { useUnitMutations } from '../hooks/use-unit-mutations'
import { useUnit } from '../unit-queries'
import { formatDate } from '@/lib/format'

export function UnitDetailPage() {
  const { unitId } = useParams({ from: '/admin/units/$unitId/' })
  const { search } = useUnitNavigation()
  const query = useUnit(unitId)
  const mutations = useUnitMutations(unitId)
  const [confirmation, setConfirmation] = useState<'release' | 'archive'>(
    'archive',
  )
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const returnToHeading = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)
  if (!z.uuid().safeParse(unitId).success)
    return <UnitUnavailable title="Invalid unit ID" search={search} />
  const unit = query.data

  async function confirm() {
    if (mutations.busy || !confirmationOpen) return
    try {
      const result =
        confirmation === 'archive'
          ? await mutations.archive()
          : await mutations.release()
      if (result) {
        returnToHeading.current = true
        setConfirmationOpen(false)
      }
    } catch (error) {
      toast.add({
        title:
          confirmation === 'archive'
            ? 'Unable to archive unit'
            : 'Unable to release resident',
        description: getErrorMessage(error),
        type: 'error',
      })
    }
  }

  return (
    <UnitPage
      title="Unit Details"
      description="Unit information and resident placement."
      search={search}
      headingRef={headingRef}
      breadcrumbs={<UnitBreadcrumbs current="Unit Details" search={search} />}
    >
      {(query.isPending || query.error) && (
        <UnitReadState
          loading={query.isPending}
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      )}
      {unit && (
        <>
          <section
            aria-label="Unit information"
            className="rounded-xl border bg-card p-5"
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  ['Unit Name', unit.unitNumber],
                  ['Floor', String(unit.floor)],
                  ['Status', <UnitStatusBadge status={unit.displayStatus} />],
                  [
                    'Archived',
                    <UnitArchivedBadge archived={unit.isArchived} />,
                  ],
                  [
                    'Resident',
                    unit.activeResident
                      ? `${unit.activeResident.name} · ${unit.activeResident.loginIdentifier}`
                      : 'No resident',
                  ],
                  ['Created', formatDate(unit.createdAt)],
                  ['Updated', formatDate(unit.updatedAt)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-medium wrap-anywhere">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <UnitDetailActions
              unit={unit}
              search={search}
              busy={mutations.busy}
              confirmationOpen={confirmationOpen}
              triggerRef={actionsRef}
              onConfirm={(action) => {
                returnToHeading.current = false
                setConfirmation(action)
                setConfirmationOpen(true)
              }}
            />
            {unit.isArchived && (
              <p className="mt-4 text-sm text-muted-foreground">
                This unit is archived. Its details and history remain available;
                it cannot be edited or restored.
              </p>
            )}
          </section>
          <UnitConfirmationDialog
            open={confirmationOpen}
            busy={mutations.busy}
            title={
              confirmation === 'archive'
                ? `Archive ${unit.unitNumber}?`
                : `Release ${unit.activeResident?.name ?? 'resident'} from ${unit.unitNumber}?`
            }
            description={
              confirmation === 'archive'
                ? 'Archiving is permanent. The unit must be empty and have no reports awaiting closure. Historical reports stay available.'
                : 'The resident account remains active and can be placed in another unit.'
            }
            destructive
            confirmDisabled={
              confirmation === 'archive' && !!unit.activeResident
            }
            confirmLabel={
              mutations.archiving
                ? 'Archiving…'
                : mutations.releasing
                  ? 'Releasing…'
                  : confirmation === 'archive'
                    ? 'Confirm archive'
                    : 'Confirm release'
            }
            finalFocus={() =>
              returnToHeading.current ? headingRef.current : actionsRef.current
            }
            onCancel={() => setConfirmationOpen(false)}
            onConfirm={() => {
              void confirm()
            }}
          />
        </>
      )}
    </UnitPage>
  )
}
