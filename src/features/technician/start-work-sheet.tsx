import { useEffect, useRef, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { QueryObserverResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { TimePicker } from '@/components/time-picker'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FullScreenLoader } from '@/components/full-screen-loader'
import { toast } from '@/components/ui/toast'
import type { ReportDetail } from '@/features/admin/reports/report-schema'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import {
  startWorkFormSchema,
  startWorkPayload,
  type StartWorkForm,
} from './start-work-schema'
import { useStartWork } from './use-start-work'
import { ArrivalDatePicker } from './arrival-date-picker'

const validationDetails = z.object({ issues: z.array(z.unknown()) })
const arrivalIssue = z.object({
  path: z.tuple([z.literal('estimatedArrivalAt')]),
  message: z.string(),
})

function currentWibTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

export function StartWorkSheet({
  actorId,
  report,
  disabled,
  heading,
  refresh,
  onAccessLost,
}: {
  actorId: string
  report: ReportDetail
  disabled: boolean
  heading: RefObject<HTMLHeadingElement | null>
  refresh: () => Promise<QueryObserverResult<ReportDetail, Error>>
  onAccessLost: () => void
}) {
  const start = useStartWork(actorId, report.id)
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [feedback, setFeedback] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const returnToHeading = useRef(false)
  const mounted = useRef(true)
  const [viewport, setViewport] = useState<{ height: number; bottom: number }>()
  const form = useForm<StartWorkForm>({
    resolver: zodResolver(startWorkFormSchema),
    defaultValues: { arrivalDate: '', arrivalTime: currentWibTime() },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const busy = start.busy || checking
  const eligible =
    report.status === 'ASSIGNED' &&
    report.assignment?.technician?.id === actorId
  const { errors } = form.formState

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!open || eligible || busy) return
    const frame = requestAnimationFrame(() => {
      returnToHeading.current = true
      setOpen(false)
      heading.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, eligible, busy, heading])
  useEffect(() => {
    const visual = window.visualViewport
    if (!visual) return
    const update = () =>
      setViewport({
        height: visual.height,
        bottom: Math.max(0, innerHeight - visual.height - visual.offsetTop),
      })
    update()
    visual.addEventListener('resize', update)
    visual.addEventListener('scroll', update)
    return () => {
      visual.removeEventListener('resize', update)
      visual.removeEventListener('scroll', update)
    }
  }, [])

  function close(toHeading = false) {
    returnToHeading.current = toHeading
    setOpen(false)
    if (toHeading) requestAnimationFrame(() => heading.current?.focus())
  }

  async function submit(values: StartWorkForm) {
    if (busy || disabled || !eligible) return
    setFeedback('')
    try {
      const result = await start.submit(startWorkPayload(values))
      if (!result || !mounted.current) return
      close(true)
      toast.add({ title: 'Work started', type: 'success' })
    } catch (error) {
      if (!mounted.current) return
      // Time can advance between resolver validation and payload construction.
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          const field = issue.path[0]
          if (field === 'arrivalDate' || field === 'arrivalTime')
            form.setError(field, { message: issue.message })
        }
        form.setFocus(
          error.issues[0]?.path[0] === 'arrivalDate'
            ? 'arrivalDate'
            : 'arrivalTime',
        )
        return
      }
      const status = error instanceof ApiError ? error.statusCode : undefined
      if (status === 403 || status === 404) {
        close(true)
        onAccessLost()
        return
      }
      if (status === 409) {
        close(true)
        toast.add({
          title: 'Task changed',
          description: getErrorMessage(error),
          type: 'error',
        })
        await refresh()
        return
      }
      const uncertain =
        !(error instanceof ApiError) ||
        !status ||
        status >= 500 ||
        error.code === 'INVALID_RESPONSE'
      if (uncertain) {
        // A lost response can still mean the server committed. Read first;
        // never automatically repeat the POST.
        setChecking(true)
        const result = await refresh()
        if (!mounted.current) return
        setChecking(false)
        if (result.data?.status !== 'ASSIGNED' && result.isSuccess) {
          close(true)
          return
        }
        setFeedback(
          result.isError
            ? 'We couldn’t confirm whether work started. Close this form and retry the task read before submitting again.'
            : 'Work has not started. Check your arrival estimate and try again.',
        )
      } else setFeedback(getErrorMessage(error))
      const details =
        error instanceof ApiError
          ? validationDetails.safeParse(error.details)
          : undefined
      const issue = details?.success
        ? details.data.issues
            .map((item) => arrivalIssue.safeParse(item))
            .find((item) => item.success)
        : undefined
      if (issue?.success)
        form.setError('arrivalDate', { message: issue.data.message })
      requestAnimationFrame(() => form.setFocus('arrivalDate'))
    }
  }

  return (
    <Sheet
      open={open && (eligible || busy)}
      disablePointerDismissal={busy}
      onOpenChange={(next, details) => {
        if (busy) details.cancel()
        else if (!next) close()
      }}
      onOpenChangeComplete={(next) => {
        if (!next) {
          form.reset()
          setFeedback('')
        }
      }}
    >
      {eligible && (
        <Button
          ref={trigger}
          className="min-h-12 w-full"
          disabled={disabled || busy}
          onClick={() => {
            returnToHeading.current = false
            form.reset({ arrivalDate: '', arrivalTime: currentWibTime() })
            setFeedback('')
            setOpen(true)
          }}
        >
          Start work
        </Button>
      )}
      <SheetContent
        side="bottom"
        showCloseButton={!busy}
        initialFocus={() => document.getElementById('task-arrival-date')}
        finalFocus={() =>
          returnToHeading.current || !eligible
            ? heading.current
            : trigger.current
        }
        className="w-full max-w-107.5 -translate-x-1/2 gap-0 rounded-t-2xl outline-none data-[side=bottom]:inset-x-auto data-[side=bottom]:left-1/2 max-h-[calc(100dvh-1rem-env(safe-area-inset-top))] motion-reduce:transition-none"
        style={
          viewport
            ? {
                bottom: viewport.bottom,
                maxHeight: `calc(${viewport.height}px - 1rem - env(safe-area-inset-top))`,
              }
            : undefined
        }
      >
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-16">
          <SheetTitle className="text-xl font-semibold">Start work</SheetTitle>
          <SheetDescription className="mt-2 leading-6">
            Set your estimated arrival. Confirming moves this task to In
            progress.
          </SheetDescription>
        </SheetHeader>
        <form
          id="task-start-form"
          onSubmit={(event) =>
            void form.handleSubmit(submit, (errors) => {
              form.setFocus(errors.arrivalDate ? 'arrivalDate' : 'arrivalTime')
            })(event)
          }
          noValidate
          className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-6 py-6"
        >
          <div className="rounded-xl bg-muted/70 p-4">
            <p className="text-sm font-semibold wrap-anywhere">
              Unit {report.unit.unitNumber} · Floor {report.unit.floor}
            </p>
            <p className="mt-2 text-sm leading-6 wrap-anywhere">
              {report.title}
            </p>
          </div>
          {feedback && (
            <p role="alert" className="text-sm leading-6 text-destructive-text">
              {feedback}
            </p>
          )}
          <div>
            <label
              id="task-arrival-date-label"
              htmlFor="task-arrival-date"
              className="mb-2 block text-sm font-medium"
            >
              Arrival date (WIB)
            </label>
            <Controller
              control={form.control}
              name="arrivalDate"
              render={({ field }) => (
                <ArrivalDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  buttonRef={field.ref}
                  disabled={busy}
                  invalid={!!errors.arrivalDate}
                />
              )}
            />
            {errors.arrivalDate && (
              <p
                id="task-arrival-date-error"
                role="alert"
                className="mt-2 text-sm leading-6 text-destructive-text"
              >
                {errors.arrivalDate.message}
              </p>
            )}
          </div>
          <div>
            <p
              id="task-arrival-time-label"
              className="mb-2 text-sm font-medium"
            >
              Arrival time (WIB)
            </p>
            <Controller
              control={form.control}
              name="arrivalTime"
              render={({ field }) => (
                <TimePicker
                  id="task-arrival-time"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  buttonRef={field.ref}
                  disabled={busy}
                  invalid={!!errors.arrivalTime}
                  describedBy={
                    errors.arrivalTime ? 'task-arrival-time-error' : undefined
                  }
                />
              )}
            />
            {errors.arrivalTime && (
              <p
                id="task-arrival-time-error"
                role="alert"
                className="mt-2 text-sm leading-6 text-destructive-text"
              >
                {errors.arrivalTime.message}
              </p>
            )}
          </div>
        </form>
        <SheetFooter className="shrink-0 flex-row justify-end border-t px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => close()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="task-start-form"
            className="min-h-11"
            disabled={busy || disabled || !eligible}
          >
            Start
          </Button>
        </SheetFooter>
        <FullScreenLoader
          open={busy}
          message={checking ? 'Checking task status…' : 'Starting work…'}
        />
      </SheetContent>
    </Sheet>
  )
}
