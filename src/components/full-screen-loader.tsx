import { LoadingIndicator } from '@/components/loading-indicator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export function FullScreenLoader({
  open,
  message = 'Please wait…',
}: {
  open: boolean
  message?: string
}) {
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen) details.cancel()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 z-110 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-5 overflow-y-auto rounded-none bg-background/60 p-6 text-foreground ring-0 duration-0 data-open:animate-none data-closed:animate-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Action in progress</DialogTitle>
        <DialogDescription className="sr-only">
          Please wait until the action finishes.
        </DialogDescription>
        <LoadingIndicator />
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="max-w-md text-center text-sm leading-6 wrap-anywhere"
        >
          {message}
        </p>
      </DialogContent>
    </Dialog>
  )
}
