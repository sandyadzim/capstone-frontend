import { useEffect, useRef, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, X } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from '@/components/ui/toast'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { useReportReview } from '../hooks/use-report-review'
import {
  reportPrioritySchema,
  reportVerifySchema,
  reportRejectSchema,
  reportReviewFormSchema,
  reportRejectFormSchema,
  type ReportDetail,
  type ReportReviewForm,
} from '../report-schema'
import { ReportPriorityBadge } from './report-badges'

const reviewIssueSchema = z.object({
  issues: z.array(z.unknown()),
})
const fieldIssueSchema = z.object({
  path: z.tuple([z.enum(['finalPriority', 'reviewNote', 'rejectionReason'])]),
  message: z.string(),
})

function ReportReviewDialog({
  decision,
  report,
  disabled,
  review,
  headingRef,
}: {
  decision: 'verify' | 'reject'
  report: ReportDetail
  disabled: boolean
  review: ReturnType<typeof useReportReview>
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnToHeading = useRef(false)
  const rejection = decision === 'reject'
  const label = rejection ? 'Reject' : 'Verify'
  const prefix = `report-${decision}`
  const form = useForm<ReportReviewForm>({
    resolver: zodResolver(
      rejection ? reportRejectFormSchema : reportReviewFormSchema,
    ),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
    defaultValues: {
      finalPriority: undefined,
      rejectionReason: '',
      reviewNote: '',
    },
  })
  const { errors } = form.formState
  const close = (toHeading = false) => {
    returnToHeading.current = toHeading
    form.reset()
    setOpen(false)
    if (toHeading) requestAnimationFrame(() => headingRef.current?.focus())
  }
  // A status refresh closes the obsolete form without changing a Reported draft.
  useEffect(() => {
    if (!open || review.busy || report.status === 'REPORTED') return
    const frame = requestAnimationFrame(() => {
      form.reset()
      setOpen(false)
      headingRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, review.busy, report.status, form, headingRef])

  async function submit(values: ReportReviewForm) {
    if (disabled || review.busy || report.status !== 'REPORTED') return
    try {
      const result = await review.submit(
        rejection
          ? { decision: 'reject', values: reportRejectSchema.parse(values) }
          : {
              decision: 'verify',
              values: reportVerifySchema.parse({
                finalPriority: values.finalPriority,
                reviewNote: values.reviewNote,
              }),
            },
      )
      if (result) {
        close(true)
        toast.add({
          title: rejection ? 'Report rejected' : 'Report verified',
          type: 'success',
        })
      }
    } catch (error) {
      toast.add({
        title: `Unable to ${decision} report`,
        description: getErrorMessage(error),
        type: 'error',
      })
      if (
        error instanceof ApiError &&
        [404, 409].includes(error.statusCode ?? 0)
      ) {
        close(true)
        await review.refresh()
        return
      }
      const details =
        error instanceof ApiError && error.code === 'VALIDATION_ERROR'
          ? reviewIssueSchema.safeParse(error.details)
          : undefined
      const issues = details?.success
        ? details.data.issues.flatMap((issue) => {
            const parsed = fieldIssueSchema.safeParse(issue)
            return parsed.success &&
              (rejection || parsed.data.path[0] !== 'rejectionReason')
              ? [parsed.data]
              : []
          })
        : []
      for (const issue of issues)
        form.setError(issue.path[0], { message: issue.message })
      requestAnimationFrame(() => {
        if (issues.length) form.setFocus(issues[0].path[0])
      })
    }
  }

  return (
    <Dialog
      open={open && (report.status === 'REPORTED' || review.busy)}
      disablePointerDismissal={review.busy}
      onOpenChange={(next, details) => {
        if (review.busy) {
          details.cancel()
          return
        }
        if (next) {
          if (disabled || report.status !== 'REPORTED') {
            details.cancel()
            return
          }
          returnToHeading.current = false
          form.reset({
            finalPriority: report.proposedPriority ?? undefined,
            rejectionReason: '',
            reviewNote: '',
          })
          setOpen(true)
        } else close()
      }}
    >
      {report.status === 'REPORTED' && (
        <DialogTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant={rejection ? 'destructive' : 'default'}
              className={`min-h-11 px-4 ${rejection ? 'text-destructive-text hover:bg-destructive/15 dark:bg-destructive/10 dark:hover:bg-destructive/15' : ''}`}
              disabled={disabled || review.busy}
            />
          }
        >
          {rejection ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}
          {label}
        </DialogTrigger>
      )}
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 motion-reduce:animate-none! sm:max-w-md"
        finalFocus={() =>
          returnToHeading.current || report.status !== 'REPORTED'
            ? headingRef.current
            : triggerRef.current
        }
      >
        <DialogHeader>
          <DialogTitle className="text-lg leading-6 wrap-anywhere">
            {label} {report.reportNumber}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {rejection
              ? 'Reject this report with a reason for the reporter.'
              : 'Set the final priority and verify this report for technician assignment.'}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => {
            void form.handleSubmit(submit, (errors) => {
              const first = (
                ['finalPriority', 'rejectionReason', 'reviewNote'] as const
              ).find((field) => errors[field])
              if (first) form.setFocus(first)
            })(event)
          }}
        >
          <Controller
            name="finalPriority"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                className="data-[invalid=true]:text-foreground"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor={`${prefix}-priority`}>
                  Final priority
                </FieldLabel>
                <Select
                  value={field.value ?? null}
                  disabled={review.busy}
                  onValueChange={(value) => {
                    field.onChange(value ?? undefined)
                    void form.trigger('finalPriority')
                  }}
                >
                  <SelectTrigger
                    id={`${prefix}-priority`}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    className="min-h-11 w-full"
                    aria-required="true"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid
                        ? `${prefix}-priority-error`
                        : undefined
                    }
                  >
                    <SelectValue placeholder="Select final priority">
                      {field.value ? (
                        <ReportPriorityBadge priority={field.value} />
                      ) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {reportPrioritySchema.options.map((value) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className="min-h-11"
                      >
                        <ReportPriorityBadge priority={value} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError
                    className="text-destructive-text"
                    id={`${prefix}-priority-error`}
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />
          {rejection && (
            <Field
              className="data-[invalid=true]:text-foreground"
              data-invalid={!!errors.rejectionReason}
            >
              <FieldLabel htmlFor={`${prefix}-reason`}>
                Rejection reason
              </FieldLabel>
              <Textarea
                id={`${prefix}-reason`}
                {...form.register('rejectionReason')}
                required
                readOnly={review.busy}
                className="min-h-24"
                aria-invalid={!!errors.rejectionReason}
                aria-describedby={`${prefix}-reason-help${errors.rejectionReason ? ` ${prefix}-reason-error` : ''}`}
              />
              <p
                id={`${prefix}-reason-help`}
                className="text-sm leading-6 text-muted-foreground"
              >
                The reporter can see this reason.
              </p>
              {errors.rejectionReason && (
                <FieldError
                  className="text-destructive-text"
                  id={`${prefix}-reason-error`}
                  errors={[errors.rejectionReason]}
                />
              )}
            </Field>
          )}
          <Field
            className="data-[invalid=true]:text-foreground"
            data-invalid={!!errors.reviewNote}
          >
            <FieldLabel htmlFor={`${prefix}-note`}>
              Internal review note (optional)
            </FieldLabel>
            <Textarea
              id={`${prefix}-note`}
              {...form.register('reviewNote')}
              readOnly={review.busy}
              className="min-h-24"
              aria-invalid={!!errors.reviewNote}
              aria-describedby={`${prefix}-note-help${errors.reviewNote ? ` ${prefix}-note-error` : ''}`}
            />
            <p
              id={`${prefix}-note-help`}
              className="text-sm leading-6 text-muted-foreground"
            >
              Only administrators can see this note.
            </p>
            {errors.reviewNote && (
              <FieldError
                className="text-destructive-text"
                id={`${prefix}-note-error`}
                errors={[errors.reviewNote]}
              />
            )}
          </Field>
          <DialogFooter className="-mx-5 -mb-5 flex-row flex-wrap justify-end p-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-4"
              disabled={review.busy}
              onClick={() => close()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={rejection ? 'destructive' : 'default'}
              className={`min-h-11 px-4 ${rejection ? 'text-destructive-text hover:bg-destructive/15 dark:bg-destructive/10 dark:hover:bg-destructive/15' : ''}`}
              disabled={disabled || review.busy}
              aria-busy={review.busy}
            >
              {label} report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReportReviewActions({
  report,
  disabled,
  headingRef,
}: {
  report: ReportDetail
  disabled: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const review = useReportReview(report.id)
  return (
    <>
      <div
        className={
          report.status === 'REPORTED'
            ? '-mx-5 -mb-5 mt-5 flex flex-wrap justify-end gap-2 border-t p-4'
            : undefined
        }
      >
        <ReportReviewDialog
          decision="reject"
          report={report}
          disabled={disabled}
          review={review}
          headingRef={headingRef}
        />
        <ReportReviewDialog
          decision="verify"
          report={report}
          disabled={disabled}
          review={review}
          headingRef={headingRef}
        />
      </div>
      <FullScreenLoader open={review.busy} />
    </>
  )
}
