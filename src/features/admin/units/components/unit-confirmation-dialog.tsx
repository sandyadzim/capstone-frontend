import { useRef, type ReactNode, type RefObject } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function UnitConfirmationDialog({
  open,
  busy,
  title,
  description,
  children,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  finalFocus,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  title: string
  description: ReactNode
  children?: ReactNode
  confirmLabel: string
  destructive?: boolean
  confirmDisabled?: boolean
  finalFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null)
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <Dialog
      open={open}
      disablePointerDismissal={busy}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen) {
          if (busy) details.cancel()
          else onCancel()
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-md"
        initialFocus={titleRef}
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-lg leading-6 outline-none wrap-anywhere"
          >
            {title}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="-mx-5 -mb-5 p-5">
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={busy}
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            className={`min-h-11 px-4 ${destructive ? 'text-destructive-text' : ''}`}
            disabled={busy || confirmDisabled}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {busy && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
