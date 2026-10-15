import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { FullScreenLoader } from '@/components/full-screen-loader'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCreateReport } from '@/features/admin/reports/hooks/use-create-report'
import { ResidentReportContext } from './resident-report-context'
import { residentUnitQueryOptions } from './resident-queries'
import { ResidentReportForm } from './resident-report-form'

export function ResidentReportProvider({
  actorId,
  children,
}: {
  actorId: string
  children: ReactNode
}) {
  const unit = useQuery(residentUnitQueryOptions(actorId))
  const [open, setOpen] = useState(false)
  const [instance, setInstance] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const canReport = !!unit.data?.unit && !unit.isError

  return (
    <ResidentReportContext
      value={{
        canReport,
        hasUnit: !!unit.data?.unit,
        openReport: (button) => {
          if (!canReport || open || busy) return
          trigger.current = button
          setInstance((value) => value + 1)
          setMounted(true)
          setOpen(true)
        },
      }}
    >
      {children}
      <Sheet
        open={open}
        onOpenChange={(next, details) => {
          if (!next && busy) details.cancel()
          else setOpen(next)
        }}
        onOpenChangeComplete={(next) => {
          if (!next) setMounted(false)
        }}
      >
        {mounted && (
          <ResidentReportSheet
            key={instance}
            actorId={actorId}
            trigger={trigger}
            onBusyChange={setBusy}
            onClose={() => setOpen(false)}
          />
        )}
      </Sheet>
    </ResidentReportContext>
  )
}

function ResidentReportSheet({
  actorId,
  trigger,
  onBusyChange,
  onClose,
}: {
  actorId: string
  trigger: React.RefObject<HTMLButtonElement | null>
  onBusyChange: (busy: boolean) => void
  onClose: () => void
}) {
  const creation = useCreateReport()
  const heading = useRef<HTMLHeadingElement>(null)
  const [viewport, setViewport] = useState<{ height: number; bottom: number }>()
  const complete = !!creation.report && !creation.busy

  useEffect(() => {
    onBusyChange(creation.busy)
  }, [creation.busy, onBusyChange])

  useEffect(() => {
    if (!complete) return
    const frame = requestAnimationFrame(() => heading.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [complete])

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return
    const update = () =>
      setViewport({
        height: visualViewport.height,
        bottom: Math.max(
          0,
          window.innerHeight - visualViewport.height - visualViewport.offsetTop,
        ),
      })
    update()
    visualViewport.addEventListener('resize', update)
    visualViewport.addEventListener('scroll', update)
    return () => {
      visualViewport.removeEventListener('resize', update)
      visualViewport.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <SheetContent
      side="bottom"
      showCloseButton={!creation.busy}
      initialFocus={heading}
      finalFocus={() =>
        trigger.current?.isConnected
          ? trigger.current
          : document.getElementById('main-content')
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
      <FullScreenLoader
        open={creation.busy}
        message={creation.progress || 'Submitting report…'}
      />
      {!complete && (
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-16">
          <SheetTitle
            ref={heading}
            tabIndex={-1}
            className="text-xl leading-7 outline-none"
          >
            Report a problem
          </SheetTitle>
          <SheetDescription className="mt-1 leading-6">
            Tell us what needs attention in your unit.
          </SheetDescription>
        </SheetHeader>
      )}
      {complete ? (
        <>
          <div className="min-h-0 space-y-4 justify-items-center overflow-y-auto overscroll-contain px-6 py-8 text-center">
            <CheckCircle2 aria-hidden="true" className="size-10 text-primary" />
            <div>
              <SheetTitle
                ref={heading}
                tabIndex={-1}
                className="text-xl leading-7 outline-none"
              >
                Report created successfully
              </SheetTitle>
              <SheetDescription className="mt-1 leading-6">
                Your report is awaiting admin review.
              </SheetDescription>
            </div>
            {creation.uploadError && (
              <p
                role="alert"
                className="text-sm leading-6 text-destructive-text wrap-anywhere"
              >
                Your report was created, but some selected photos could not be
                uploaded.
              </p>
            )}
          </div>
          <SheetFooter className="shrink-0 border-t px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button className="min-h-11 w-full" onClick={onClose}>
              Done
            </Button>
          </SheetFooter>
        </>
      ) : (
        <ResidentReportForm
          actorId={actorId}
          creation={creation}
          onCancel={onClose}
        />
      )}
    </SheetContent>
  )
}
