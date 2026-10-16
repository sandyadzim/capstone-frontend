import { useEffect, useRef, useState, type RefObject } from 'react'
import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useReportClosure } from '../hooks/use-report-closure'
import type { ReportDetail } from '../report-schema'

export function ReportCloseAction({
  report,
  disabled,
  headingRef,
}: {
  report: ReportDetail
  disabled: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const closure = useReportClosure(report.id)
  const completed = report.status === 'COMPLETED'
  const eligible = completed && !!report.maintenanceResult && !!report.receipt
  const missing =
    !report.maintenanceResult && !report.receipt
      ? 'A work result and receipt are required before closing this report.'
      : !report.maintenanceResult
        ? 'A work result is required before closing this report.'
        : !report.receipt
          ? 'A receipt is required before closing this report.'
          : undefined
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const returnToHeading = useRef(false)
  const wasOpen = useRef(false)
  useEffect(() => {
    wasOpen.current = open
  }, [open])
  useEffect(
    () => () => {
      if (wasOpen.current)
        requestAnimationFrame(() => headingRef.current?.focus())
    },
    [headingRef],
  )
  const close = (toHeading = false) => {
    returnToHeading.current = toHeading
    setOpen(false)
    if (toHeading) requestAnimationFrame(() => headingRef.current?.focus())
  }
  useEffect(() => {
    if (!open || closure.busy || eligible) return
    const frame = requestAnimationFrame(() => {
      setOpen(false)
      headingRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, closure.busy, eligible, headingRef])

  async function submit() {
    if (disabled || closure.busy || !eligible) return
    try {
      const result = await closure.submit()
      if (result) {
        close(true)
        toast.add({ title: 'Report closed', type: 'success' })
      }
    } catch (error) {
      toast.add({
        title: 'Unable to close report',
        description: getErrorMessage(error),
        type: 'error',
      })
      if (
        error instanceof ApiError &&
        [404, 409].includes(error.statusCode ?? 0)
      ) {
        close(true)
        await closure.refresh()
        return
      }
      requestAnimationFrame(() => confirmRef.current?.focus())
    }
  }

  return (
    <>
      <Dialog
        open={open && (eligible || closure.busy)}
        disablePointerDismissal={closure.busy}
        onOpenChange={(next, details) => {
          if (closure.busy || (next && (disabled || !eligible))) {
            details.cancel()
            return
          }
          if (next) {
            returnToHeading.current = false
            setOpen(true)
          } else close()
        }}
      >
        {completed && (
          <div className="-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-3 border-t p-4">
            {missing && (
              <p
                id="report-close-prerequisites"
                className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground wrap-anywhere"
              >
                {missing}
              </p>
            )}
            <DialogTrigger
              render={
                <Button
                  ref={triggerRef}
                  type="button"
                  className="min-h-11 px-4"
                  disabled={disabled || closure.busy || !eligible}
                  aria-describedby={
                    missing ? 'report-close-prerequisites' : undefined
                  }
                />
              }
            >
              <CheckCheck aria-hidden="true" />
              Close report
            </DialogTrigger>
          </div>
        )}
        <DialogContent
          showCloseButton={false}
          initialFocus={titleRef}
          finalFocus={() =>
            returnToHeading.current || !eligible
              ? headingRef.current
              : triggerRef.current
          }
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 motion-reduce:animate-none! sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="text-lg leading-6 outline-none wrap-anywhere"
            >
              Close report · {report.reportNumber}
            </DialogTitle>
            <DialogDescription className="leading-6">
              Closing approves the recorded work and changes this report to
              Closed. Review the work result, costs, and receipt before
              confirming.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-5 -mb-5 flex-row flex-wrap justify-end p-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-4"
              disabled={closure.busy}
              onClick={() => close()}
            >
              Cancel
            </Button>
            <Button
              ref={confirmRef}
              type="button"
              className="min-h-11 px-4"
              disabled={disabled || closure.busy || !eligible}
              aria-busy={closure.busy}
              onClick={() => {
                void submit()
              }}
            >
              Close report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FullScreenLoader open={closure.busy} />
    </>
  )
}
