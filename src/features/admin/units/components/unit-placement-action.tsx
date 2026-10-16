import { useEffect, useRef, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { DataTable, type DataColumn } from '@/components/data-table'
import { Pagination } from '@/components/pagination'
import { SearchFilter } from '@/components/list-filters'
import { FullScreenLoader } from '@/components/full-screen-loader'
import { toast } from '@/components/ui/toast'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { residentsQueryOptions, unitDetailKey } from '../unit-queries'
import {
  residentPlacementSchema,
  type ResidentAccount,
  type Unit,
} from '../unit-schema'
import { unitFieldErrors } from '../unit-utils'
import type { useUnitMutations } from '../hooks/use-unit-mutations'

export function UnitPlacementAction({
  unit,
  disabled,
  placement,
  headingRef,
}: {
  unit: Unit
  disabled: boolean
  placement: ReturnType<typeof useUnitMutations>
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const client = useQueryClient()
  const eligible = !unit.isArchived && !unit.activeResident
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState(true)
  const [selected, setSelected] = useState<ResidentAccount | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [recovering, setRecovering] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnToHeading = useRef(false)
  const form = useForm<z.infer<typeof residentPlacementSchema>>({
    resolver: zodResolver(residentPlacementSchema),
    defaultValues: { residentUserId: '' },
    shouldFocusError: false,
  })
  const options = residentsQueryOptions({
    page,
    pageSize,
    q: q.trim() || undefined,
  })
  const query = useQuery({
    ...options,
    enabled: open && browsing && eligible && !placement.busy && !recovering,
  })
  usePageCorrection(query.data?.meta, page, setPage)

  function reset() {
    form.reset({ residentUserId: '' })
    setSelected(null)
    setBrowsing(true)
    setQ('')
    setPage(1)
    setPageSize(20)
  }
  function close(toHeading = false) {
    returnToHeading.current = toHeading
    void client.cancelQueries({ queryKey: options.queryKey })
    setOpen(false)
    reset()
    if (toHeading) requestAnimationFrame(() => headingRef.current?.focus())
  }
  useEffect(() => {
    if (!open || eligible || placement.placing) return
    const frame = requestAnimationFrame(() => {
      returnToHeading.current = true
      setOpen(false)
      form.reset({ residentUserId: '' })
      setSelected(null)
      headingRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, eligible, placement.placing, form, headingRef])

  function select(resident: ResidentAccount) {
    if (
      query.isFetching ||
      query.error ||
      placement.busy ||
      recovering ||
      resident.activeUnit ||
      !resident.isActive
    )
      return
    setSelected(resident)
    form.setValue('residentUserId', resident.id, { shouldValidate: true })
    setBrowsing(false)
    form.setFocus('residentUserId')
  }
  async function submit({
    residentUserId,
  }: z.infer<typeof residentPlacementSchema>) {
    if (disabled || placement.busy || recovering || !eligible || !selected)
      return
    try {
      const saved = await placement.place(residentUserId)
      if (saved) close(true)
    } catch (error) {
      toast.add({
        title: 'Unable to place resident',
        description: getErrorMessage(error),
        type: 'error',
      })
      if (
        error instanceof ApiError &&
        [403, 404, 409].includes(error.statusCode ?? 0)
      ) {
        setSelected(null)
        form.reset({ residentUserId: '' })
        setBrowsing(true)
        setRecovering(true)
        try {
          await Promise.all([
            client.invalidateQueries({ queryKey: unitDetailKey(unit.id) }),
            query.refetch(),
          ])
        } finally {
          setRecovering(false)
          requestAnimationFrame(() => form.setFocus('residentUserId'))
        }
        return
      }
      for (const issue of unitFieldErrors(error))
        if (issue.path[0] === 'residentUserId')
          form.setError('residentUserId', { message: issue.message })
      requestAnimationFrame(() => form.setFocus('residentUserId'))
    }
  }
  const selectButton = (resident: ResidentAccount) => (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 px-4 text-primary"
      aria-label={`Select resident ${resident.name}`}
      disabled={
        query.isFetching ||
        !!query.error ||
        placement.busy ||
        recovering ||
        !!resident.activeUnit ||
        !resident.isActive
      }
      onClick={() => select(resident)}
    >
      Select
    </Button>
  )
  const columns: DataColumn<ResidentAccount>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (resident) => (
        <span className="wrap-anywhere">{resident.name}</span>
      ),
    },
    { id: 'select', header: 'Select', sticky: 'right', cell: selectButton },
  ]
  return (
    <>
      <Dialog
        open={open && (eligible || placement.placing)}
        disablePointerDismissal={placement.busy || recovering}
        onOpenChange={(next, details) => {
          if (
            placement.busy ||
            recovering ||
            (next && (disabled || !eligible))
          ) {
            details.cancel()
            return
          }
          if (next) {
            returnToHeading.current = false
            reset()
            setOpen(true)
          } else close()
        }}
      >
        {eligible && (
          <DialogTrigger
            render={
              <Button
                ref={triggerRef}
                type="button"
                className="min-h-11 px-4"
                disabled={disabled || placement.busy || recovering}
              />
            }
          >
            <UserPlus aria-hidden="true" />
            Place resident
          </DialogTrigger>
        )}
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 motion-reduce:animate-none! sm:max-w-3xl"
          finalFocus={() =>
            returnToHeading.current || !eligible
              ? headingRef.current
              : triggerRef.current
          }
        >
          <DialogHeader>
            <DialogTitle className="text-lg leading-6 wrap-anywhere">
              Place resident · {unit.unitNumber}
            </DialogTitle>
            <DialogDescription className="leading-6">
              Choose a resident without a unit.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="min-w-0 space-y-5"
            onSubmit={(event) => {
              void form.handleSubmit(submit, () =>
                form.setFocus('residentUserId'),
              )(event)
            }}
          >
            <Controller
              name="residentUserId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  className="data-[invalid=true]:text-foreground"
                >
                  <FieldLabel id="placement-resident-label">
                    Resident
                  </FieldLabel>
                  <div
                    ref={field.ref}
                    tabIndex={-1}
                    role="group"
                    aria-labelledby="placement-resident-label"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? 'placement-resident-error' : undefined
                    }
                    className="rounded-lg border border-input focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {browsing ? (
                      <div className="space-y-3 py-3">
                        <div className="px-4">
                          <SearchFilter
                            label="Search residents"
                            placeholder="Search residents"
                            value={q}
                            maxLength={254}
                            disabled={placement.busy || recovering}
                            onChange={(value) => {
                              setQ(value)
                              setPage(1)
                            }}
                          />
                        </div>
                        <DataTable
                          label="Available residents"
                          columns={columns}
                          rows={
                            query.error
                              ? []
                              : (query.data?.data.filter(
                                  (resident) => !resident.activeUnit,
                                ) ?? [])
                          }
                          rowId={(resident) => resident.id}
                          loading={query.isPending}
                          updating={query.isFetching && !query.isPending}
                          error={
                            query.error
                              ? getErrorMessage(query.error)
                              : undefined
                          }
                          onRetry={() => void query.refetch()}
                          emptyMessage={
                            q.trim()
                              ? 'No residents match your search'
                              : 'No unassigned residents are available.'
                          }
                          mobileRecord={(resident) => (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <dl className="min-w-0 flex-1 space-y-2 text-sm">
                                <div>
                                  <dt className="text-xs text-muted-foreground">
                                    Name
                                  </dt>
                                  <dd className="mt-1 wrap-anywhere">
                                    {resident.name}
                                  </dd>
                                </div>
                              </dl>
                              {selectButton(resident)}
                            </div>
                          )}
                        />
                        {query.data && !query.error && (
                          <Pagination
                            meta={query.data.meta}
                            disabled={
                              query.isFetching || placement.busy || recovering
                            }
                            onPageChange={(next) => {
                              setPage(next)
                              form.setFocus('residentUserId')
                            }}
                            onPageSizeChange={(size) => {
                              setPageSize(size)
                              setPage(1)
                              form.setFocus('residentUserId')
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        <p className="min-w-0 flex-1 text-sm font-medium wrap-anywhere">
                          {selected?.name}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 px-4 text-primary"
                          disabled={placement.busy || recovering}
                          onClick={() => setBrowsing(true)}
                        >
                          Change
                        </Button>
                      </div>
                    )}
                  </div>
                  {fieldState.error && (
                    <FieldError
                      id="placement-resident-error"
                      className="text-destructive-text"
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />
            <DialogFooter className="-mx-5 -mb-5 flex-row flex-wrap justify-end p-5">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={placement.busy || recovering}
                onClick={() => close()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11 px-4"
                disabled={disabled || placement.busy || recovering}
                aria-busy={placement.placing}
              >
                Place resident
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <FullScreenLoader open={placement.placing} />
    </>
  )
}
