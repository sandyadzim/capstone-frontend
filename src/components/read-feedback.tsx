import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function InformationLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

export function ReadError({
  message,
  retry,
  busy,
}: {
  message: string
  retry: () => void
  busy: boolean
}) {
  return (
    <div className="mt-3">
      <p role="alert" className="text-sm leading-6 text-destructive-text">
        {message}
      </p>
      <Button
        variant="outline"
        className="mt-2 min-h-11"
        disabled={busy}
        onClick={retry}
      >
        {busy ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  )
}
