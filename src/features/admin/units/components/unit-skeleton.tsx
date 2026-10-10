import { Skeleton } from '@/components/ui/skeleton'

export type UnitSkeletonVariant = 'form' | 'detail' | 'records' | 'history'

export function UnitSkeleton({
  variant = 'detail',
}: {
  variant?: UnitSkeletonVariant
}) {
  if (variant === 'history')
    return (
      <section
        aria-label="Loading unit page"
        aria-busy="true"
        className="space-y-5"
      >
        <p role="status" className="sr-only">
          Loading unit page…
        </p>
        <div aria-hidden="true" className="space-y-5">
          <div className="space-y-5 rounded-xl border bg-card p-5">
            <Skeleton className="h-6 w-3/4" />
            <div className="grid gap-5 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((key) => (
                <div key={key} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6 rounded-xl border bg-card p-5">
            <Skeleton className="h-6 w-48" />
            {[0, 1, 2].map((key) => (
              <div key={key} className="flex gap-4">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  return (
    <section
      aria-label="Loading unit page"
      aria-busy="true"
      className="rounded-xl border bg-card p-5"
    >
      <p role="status" className="sr-only">
        Loading unit page…
      </p>
      <div aria-hidden="true" className="space-y-5">
        <div
          className={
            variant === 'detail' ? 'grid gap-5 sm:grid-cols-2' : 'space-y-5'
          }
        >
          {Array.from(
            { length: variant === 'form' ? 2 : variant === 'records' ? 3 : 6 },
            (_, key) => (
              <div key={key} className="space-y-2">
                {variant !== 'records' && <Skeleton className="h-4 w-24" />}
                <Skeleton
                  className={
                    variant === 'form'
                      ? 'h-11 w-full'
                      : variant === 'records'
                        ? 'h-16 w-full'
                        : 'h-6 w-3/4'
                  }
                />
              </div>
            ),
          )}
        </div>
        {variant === 'form' && <Skeleton className="h-11 w-48" />}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
    </section>
  )
}
