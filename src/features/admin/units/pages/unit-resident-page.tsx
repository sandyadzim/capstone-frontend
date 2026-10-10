import { getErrorMessage } from '@/lib/api/error'
import { useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useIsMutating } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ApiError } from '@/lib/api/error'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldLabel } from '@/components/ui/field'
import { UnitConfirmationDialog } from '../components/unit-confirmation-dialog'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { DataTable, type DataColumn } from '@/components/data-table'
import { Pagination } from '@/components/pagination'
import {
  UnitPage,
  UnitBreadcrumbs,
  UnitReadState,
  UnitUnavailable,
} from '../components/unit-page'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { useUnitNavigation } from '../hooks/use-unit-navigation'
import { useUnitMutations } from '../hooks/use-unit-mutations'
import { useUnit, residentsQueryOptions, unitsKey } from '../unit-queries'
import { residentPlacementSchema, type ResidentAccount } from '../unit-schema'
import { unitFieldErrors } from '../unit-utils'

export function UnitResidentPage() {
  const { unitId } = useParams({ from: '/admin/units/$unitId/resident' })
  const { search, changeSearch, navigate } = useUnitNavigation(
    '/admin/units/$unitId/resident',
  )
  const unitQuery = useUnit(unitId)
  const mutations = useUnitMutations(unitId)
  const busy = useIsMutating({ mutationKey: unitsKey }) > 0
  const [selected, setSelected] = useState<ResidentAccount | null>(null)
  const [placementOpen, setPlacementOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const selectionTrigger = useRef<HTMLButtonElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const {
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<z.infer<typeof residentPlacementSchema>>({
    resolver: zodResolver(residentPlacementSchema),
    defaultValues: { residentUserId: '' },
  })
  const query = useQuery({
    ...residentsQueryOptions({
      page: search.residentPage,
      pageSize: search.residentPageSize,
    }),
    enabled:
      !!unitQuery.data &&
      !unitQuery.data.isArchived &&
      !unitQuery.data.activeResident &&
      !busy,
  })
  usePageCorrection(query.data?.meta, search.residentPage, (residentPage) =>
    changeSearch({ residentPage }, true),
  )
  const moving = selected?.activeUnit && selected.activeUnit.id !== unitId

  function choose(resident: ResidentAccount, trigger: HTMLButtonElement) {
    selectionTrigger.current = trigger
    setSelected(resident)
    setPlacementOpen(true)
    setAcknowledged(false)
    setValue('residentUserId', resident.id)
    clearErrors()
  }

  async function submit({ residentUserId }: { residentUserId: string }) {
    if (busy || !placementOpen || !selected || (moving && !acknowledged)) return
    try {
      const unit = await mutations.place(residentUserId)
      if (unit)
        await navigate({
          to: '/admin/units/$unitId',
          params: { unitId },
          search,
        })
    } catch (error) {
      for (const issue of unitFieldErrors(error))
        if (issue.path[0] === 'residentUserId')
          setError('residentUserId', { message: issue.message })
      if (
        error instanceof ApiError &&
        [404, 409].includes(error.statusCode ?? 0)
      ) {
        setPlacementOpen(false)
        setSelected(null)
        setAcknowledged(false)
        setValue('residentUserId', '')
      }
      toast.add({
        title: 'Unable to place resident',
        description: getErrorMessage(error),
        type: 'error',
      })
    }
  }

  if (!z.uuid().safeParse(unitId).success)
    return <UnitUnavailable title="Invalid unit ID" search={search} />

  if (unitQuery.data?.isArchived || unitQuery.data?.activeResident)
    return (
      <UnitUnavailable
        title={
          unitQuery.data.isArchived ? 'Archived unit' : 'Unit already occupied'
        }
        search={search}
      />
    )

  const columns: DataColumn<ResidentAccount>[] = [
    { id: 'name', header: 'Resident', cell: (resident) => resident.name },
    {
      id: 'login',
      header: 'Login identifier',
      cell: (resident) => resident.loginIdentifier,
    },
    {
      id: 'unit',
      header: 'Current unit',
      cell: (resident) => resident.activeUnit?.unitNumber ?? 'Unassigned',
    },
    {
      id: 'select',
      header: 'Actions',
      sticky: 'right',
      cell: (resident) => (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-2 px-3 text-primary"
          aria-haspopup="dialog"
          disabled={busy}
          onClick={(event) => choose(resident, event.currentTarget)}
          aria-label={`Select ${resident.name} (${resident.loginIdentifier})`}
        >
          <UserPlus aria-hidden="true" /> Select
        </Button>
      ),
    },
  ]

  return (
    <UnitPage
      wide
      title="Resident Placement"
      description={
        unitQuery.data
          ? `Choose an active resident for ${unitQuery.data.unitNumber}. A resident may occupy one unit at a time.`
          : 'Choose an active resident. A resident may occupy one unit at a time.'
      }
      headingRef={headingRef}
      breadcrumbs={
        <UnitBreadcrumbs
          current="Resident Placement"
          unitId={unitId}
          search={search}
        />
      }
      search={search}
    >
      {(unitQuery.isPending || unitQuery.error) && (
        <UnitReadState
          variant="records"
          loading={unitQuery.isPending}
          error={unitQuery.error}
          onRetry={() => {
            void unitQuery.refetch()
          }}
        />
      )}
      {unitQuery.data && (
        <>
          <Card className="gap-0 py-0">
            <div className="py-4">
              <DataTable
                label="Active residents"
                columns={columns}
                rows={query.data?.data ?? []}
                rowId={(resident) => resident.id}
                loading={query.isPending}
                updating={query.isFetching && !query.isPending}
                error={query.error ? getErrorMessage(query.error) : undefined}
                onRetry={() => {
                  void query.refetch()
                }}
                emptyMessage="No active residents are available. Create or activate a resident account first."
              />
            </div>
            {query.data && (
              <Pagination
                meta={query.data.meta}
                disabled={busy || query.isFetching}
                onPageChange={(residentPage) => changeSearch({ residentPage })}
                onPageSizeChange={(residentPageSize) =>
                  changeSearch({ residentPageSize, residentPage: 1 })
                }
              />
            )}
          </Card>
          <UnitConfirmationDialog
            open={placementOpen}
            busy={busy}
            title={`${moving ? 'Move' : 'Place'} ${selected?.name ?? 'resident'} in ${unitQuery.data.unitNumber}?`}
            description={
              moving
                ? `${selected?.name} will move from ${selected?.activeUnit?.unitNumber} to ${unitQuery.data.unitNumber}. Their previous unit will become vacant unless it is under maintenance.`
                : `Confirm this resident's placement in ${unitQuery.data.unitNumber}.`
            }
            confirmLabel={
              mutations.placing
                ? 'Placing…'
                : moving
                  ? 'Move resident'
                  : 'Place resident'
            }
            confirmDisabled={!selected || (!!moving && !acknowledged)}
            finalFocus={() =>
              selectionTrigger.current?.isConnected
                ? selectionTrigger.current
                : headingRef.current
            }
            onCancel={() => {
              setPlacementOpen(false)
              setAcknowledged(false)
              clearErrors()
            }}
            onConfirm={() => {
              void handleSubmit(submit)()
            }}
          >
            {selected && (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Resident</dt>
                  <dd className="mt-1 font-medium wrap-anywhere">
                    {selected.name}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Login identifier</dt>
                  <dd className="mt-1 wrap-anywhere">
                    {selected.loginIdentifier}
                  </dd>
                </div>
              </dl>
            )}
            {moving && (
              <FieldLabel
                htmlFor="resident-move-confirm"
                className="min-h-11 gap-3"
              >
                <Checkbox
                  id="resident-move-confirm"
                  checked={acknowledged}
                  disabled={busy}
                  onCheckedChange={setAcknowledged}
                  className="size-5"
                />
                I confirm this resident move.
              </FieldLabel>
            )}
            {errors.residentUserId && (
              <p role="alert" className="text-sm text-destructive-text">
                {errors.residentUserId.message}
              </p>
            )}
          </UnitConfirmationDialog>
        </>
      )}
    </UnitPage>
  )
}
