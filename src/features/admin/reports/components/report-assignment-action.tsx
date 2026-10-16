import { useEffect, useRef, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { UserRoundPlus } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { FullScreenLoader } from '@/components/full-screen-loader'
import { DataTable, type DataColumn } from '@/components/data-table'
import { SearchFilter } from '@/components/list-filters'
import { Pagination } from '@/components/pagination'
import { toast } from '@/components/ui/toast'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { accountsQueryOptions } from '@/features/admin/accounts/account-queries'
import type { Account } from '@/features/admin/accounts/account-schema'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { useReportAssignment } from '../hooks/use-report-assignment'
import {
  reportAssignSchema,
  reportAssignmentFormSchema,
  type ReportAssignmentForm,
  type ReportDetail,
} from '../report-schema'

const assignmentIssueSchema = z.object({ issues: z.array(z.unknown()) })
const fieldIssueSchema = z.object({
  path: z.tuple([z.enum(['technicianUserId', 'note'])]),
  message: z.string(),
})

export function ReportAssignmentAction({
  report,
  disabled,
  headingRef,
}: {
  report: ReportDetail
  disabled: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const assignment = useReportAssignment(report.id)
  const eligible = report.status === 'VERIFIED' && !report.assignment
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState(true)
  const [selected, setSelected] = useState<Account | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [recovering, setRecovering] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnToHeading = useRef(false)
  const wasOpen = useRef(false)
  useEffect(() => {
    wasOpen.current = open
  }, [open])
  useEffect(
    () => () => {
      // A refreshed 404 removes this action along with stale report content.
      if (wasOpen.current)
        requestAnimationFrame(() => headingRef.current?.focus())
    },
    [headingRef],
  )

  const form = useForm<ReportAssignmentForm>({
    resolver: zodResolver(reportAssignmentFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
    defaultValues: { technicianUserId: '', note: '' },
  })
  const { errors } = form.formState
  const query = useQuery({
    ...accountsQueryOptions({
      role: 'TECHNICIAN',
      isActive: 'true',
      q: q.trim() || undefined,
      page,
      pageSize,
    }),
    enabled: open && browsing && !assignment.busy && !recovering,
  })
  usePageCorrection(query.data?.meta, page, setPage)
  const reset = () => {
    form.reset({ technicianUserId: '', note: '' })
    setSelected(null)
    setBrowsing(true)
    setQ('')
    setPage(1)
    setPageSize(20)
  }
  const close = (toHeading = false) => {
    returnToHeading.current = toHeading
    setOpen(false)
    reset()
    if (toHeading) requestAnimationFrame(() => headingRef.current?.focus())
  }
  useEffect(() => {
    if (!open || assignment.busy || eligible) return
    const frame = requestAnimationFrame(() => {
      setOpen(false)
      form.reset({ technicianUserId: '', note: '' })
      setSelected(null)
      setBrowsing(true)
      setQ('')
      setPage(1)
      setPageSize(20)
      headingRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, assignment.busy, eligible, form, headingRef])

  async function submit(values: ReportAssignmentForm) {
    if (disabled || assignment.busy || recovering || !eligible) return
    try {
      const result = await assignment.submit(reportAssignSchema.parse(values))
      if (result) {
        close(true)
        toast.add({ title: 'Technician assigned', type: 'success' })
      }
    } catch (error) {
      toast.add({
        title: 'Unable to assign technician',
        description: getErrorMessage(error),
        type: 'error',
      })
      if (
        error instanceof ApiError &&
        [404, 409].includes(error.statusCode ?? 0)
      ) {
        // These errors can refer to either the report or the technician.
        // Preserve the note, refresh both, and require a fresh selection.
        setSelected(null)
        form.setValue('technicianUserId', '')
        form.clearErrors('technicianUserId')
        setBrowsing(true)
        setRecovering(true)
        try {
          await Promise.all([assignment.refresh(), query.refetch()])
        } finally {
          setRecovering(false)
          requestAnimationFrame(() => form.setFocus('technicianUserId'))
        }
        return
      }
      const details =
        error instanceof ApiError && error.code === 'VALIDATION_ERROR'
          ? assignmentIssueSchema.safeParse(error.details)
          : undefined
      const issues = details?.success
        ? details.data.issues.flatMap((issue) => {
            const parsed = fieldIssueSchema.safeParse(issue)
            return parsed.success ? [parsed.data] : []
          })
        : []
      for (const issue of issues)
        form.setError(issue.path[0], { message: issue.message })
      requestAnimationFrame(() => {
        if (issues.length) form.setFocus(issues[0].path[0])
      })
    }
  }

  const select = (account: Account) => {
    if (
      query.isFetching ||
      query.error ||
      assignment.busy ||
      recovering ||
      !account.isActive ||
      account.role !== 'TECHNICIAN'
    )
      return
    setSelected(account)
    form.setValue('technicianUserId', account.id, {
      shouldValidate: true,
      shouldDirty: true,
    })
    setBrowsing(false)
    form.setFocus('technicianUserId')
  }
  const selectButton = (account: Account) => (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 px-4 text-primary hover:text-primary"
      aria-label={`Select technician ${account.name}`}
      disabled={
        query.isFetching ||
        !!query.error ||
        recovering ||
        assignment.busy ||
        !account.isActive ||
        account.role !== 'TECHNICIAN'
      }
      onClick={() => select(account)}
    >
      Select
    </Button>
  )
  const columns: DataColumn<Account>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (account) => (
        <span className="whitespace-normal wrap-anywhere">{account.name}</span>
      ),
    },
    { id: 'select', header: 'Select', sticky: 'right', cell: selectButton },
  ]

  return (
    <>
      <Dialog
        open={open && (eligible || assignment.busy)}
        disablePointerDismissal={assignment.busy || recovering}
        onOpenChange={(next, details) => {
          if (
            assignment.busy ||
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
          <div className="-mx-5 -mb-5 mt-5 flex flex-wrap justify-end gap-2 border-t p-4">
            <DialogTrigger
              render={
                <Button
                  ref={triggerRef}
                  type="button"
                  className="min-h-11 px-4"
                  disabled={disabled || assignment.busy || recovering}
                />
              }
            >
              <UserRoundPlus aria-hidden="true" />
              Assign technician
            </DialogTrigger>
          </div>
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
              Assign technician · {report.reportNumber}
            </DialogTitle>
            <DialogDescription className="leading-6">
              Choose an active technician for this report.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="min-w-0 space-y-5"
            onSubmit={(event) => {
              void form.handleSubmit(submit, (errors) => {
                form.setFocus(
                  errors.technicianUserId ? 'technicianUserId' : 'note',
                )
              })(event)
            }}
          >
            <Controller
              name="technicianUserId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  className="data-[invalid=true]:text-foreground"
                  data-invalid={fieldState.invalid}
                >
                  <FieldLabel id="assignment-technician-label">
                    Technician
                  </FieldLabel>
                  <div
                    ref={field.ref}
                    tabIndex={-1}
                    role="group"
                    aria-labelledby="assignment-technician-label"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      errors.technicianUserId
                        ? 'assignment-technician-error'
                        : undefined
                    }
                    className="rounded-lg border border-input focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {browsing ? (
                      <div className="space-y-3 py-3">
                        <div className="px-4">
                          <SearchFilter
                            label="Search technicians"
                            placeholder="Search technicians"
                            value={q}
                            maxLength={254}
                            disabled={assignment.busy || recovering}
                            onChange={(value) => {
                              setQ(value)
                              setPage(1)
                            }}
                          />
                        </div>
                        <DataTable
                          label="Active technicians"
                          columns={columns}
                          rows={query.error ? [] : (query.data?.data ?? [])}
                          rowId={(account) => account.id}
                          loading={query.isPending}
                          updating={query.isFetching && !query.isPending}
                          error={
                            query.error
                              ? getErrorMessage(query.error)
                              : undefined
                          }
                          onRetry={() => {
                            void query.refetch()
                          }}
                          emptyMessage={
                            q.trim()
                              ? 'No technicians match your search'
                              : 'No active technicians available'
                          }
                          mobileRecord={(account) => (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <dl className="min-w-0 flex-1 space-y-2 text-sm">
                                <div>
                                  <dt className="text-xs text-muted-foreground">
                                    Name
                                  </dt>
                                  <dd className="mt-1 wrap-anywhere">
                                    {account.name}
                                  </dd>
                                </div>
                              </dl>
                              {selectButton(account)}
                            </div>
                          )}
                        />
                        {query.data && !query.error && (
                          <Pagination
                            meta={query.data.meta}
                            disabled={
                              query.isFetching || recovering || assignment.busy
                            }
                            onPageChange={(next) => {
                              setPage(next)
                              form.setFocus('technicianUserId')
                            }}
                            onPageSizeChange={(size) => {
                              setPageSize(size)
                              setPage(1)
                              form.setFocus('technicianUserId')
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-medium wrap-anywhere">
                            {selected?.name}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 px-4 text-primary hover:text-primary"
                          disabled={assignment.busy || recovering}
                          onClick={() => setBrowsing(true)}
                        >
                          Change
                        </Button>
                      </div>
                    )}
                  </div>
                  {errors.technicianUserId && (
                    <FieldError
                      id="assignment-technician-error"
                      className="text-destructive-text"
                      errors={[errors.technicianUserId]}
                    />
                  )}
                </Field>
              )}
            />
            <Field
              className="data-[invalid=true]:text-foreground"
              data-invalid={!!errors.note}
            >
              <FieldLabel htmlFor="assignment-note">
                Assignment note (optional)
              </FieldLabel>
              <Textarea
                id="assignment-note"
                {...form.register('note')}
                readOnly={assignment.busy || recovering}
                className="min-h-24 min-w-0"
                aria-invalid={!!errors.note}
                aria-describedby={`assignment-note-help${errors.note ? ' assignment-note-error' : ''}`}
              />
              <p
                id="assignment-note-help"
                className="text-sm leading-6 text-muted-foreground"
              >
                The assigned technician can see this note.
              </p>
              {errors.note && (
                <FieldError
                  id="assignment-note-error"
                  className="text-destructive-text"
                  errors={[errors.note]}
                />
              )}
            </Field>
            <DialogFooter className="-mx-5 -mb-5 flex-row flex-wrap justify-end p-5">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={assignment.busy || recovering}
                onClick={() => close()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11 px-4"
                disabled={disabled || assignment.busy || recovering}
                aria-busy={assignment.busy}
              >
                Assign technician
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <FullScreenLoader open={assignment.busy} />
    </>
  )
}
