import { Skeleton } from '@/components/ui/skeleton'

export function SettingsLoading() {
  return (
    <div role="status" aria-busy="true" className="mt-6 space-y-5">
      <span className="sr-only">Loading property settings…</span>
      <div
        aria-hidden="true"
        className="space-y-5 rounded-xl border bg-card p-5"
      >
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-3/4 max-w-72" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div
        aria-hidden="true"
        className="space-y-5 rounded-xl border bg-card p-5"
      >
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <Skeleton className="mx-auto h-40 w-full max-w-64" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
    </div>
  )
}
