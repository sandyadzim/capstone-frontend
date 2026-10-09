import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { healthQueryOptions } from '@/features/health/api'

export function HealthDemo() {
  const health = useQuery(healthQueryOptions)

  return (
    <section aria-labelledby="health-title" className="space-y-4 border-t pt-6">
      <div className="space-y-2">
        <h2 id="health-title" className="text-base font-semibold">
          API connection demo
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Check whether the backend is available. This check does not access
          property data.
        </p>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={health.isFetching}
        className="space-y-2 text-sm leading-6"
      >
        {health.isFetching ? (
          <p className="text-muted-foreground">Checking API connection…</p>
        ) : health.isError ? (
          <p className="wrap-break-word text-destructive">
            {health.error.message}
          </p>
        ) : health.isSuccess ? (
          <>
            <p className="font-medium text-primary">API is connected.</p>
            <pre className="rounded-lg bg-muted p-3 text-foreground">
              <code>{JSON.stringify(health.data, null, 2)}</code>
            </pre>
          </>
        ) : (
          <p className="text-muted-foreground">
            Connection has not been checked yet.
          </p>
        )}
      </div>
      <Button
        variant="outline"
        className="min-h-11 px-4"
        disabled={health.isFetching}
        onClick={() => void health.refetch()}
      >
        {health.isFetching
          ? 'Checking…'
          : health.isError
            ? 'Try again'
            : 'Check API connection'}
      </Button>
    </section>
  )
}
