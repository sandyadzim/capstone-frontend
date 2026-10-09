import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RoutePending() {
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted-foreground"
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-4 animate-spin motion-reduce:animate-none"
      />{' '}
      Loading page…
    </div>
  )
}

export function RouteError({ reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        This page could not load
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Try loading it again. If the problem continues, refresh the browser.
      </p>
      <Button
        className="min-h-11 px-4"
        onClick={() => {
          void router.invalidate()
          reset()
        }}
      >
        Try again
      </Button>
    </div>
  )
}

export function RouteNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        This address does not match a page. Go back to your portal to continue.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          nativeButton={false}
          role="link"
          className="min-h-11 px-4"
          render={<Link to="/" />}
        >
          Resident home
        </Button>
        <Button
          nativeButton={false}
          role="link"
          variant="outline"
          className="min-h-11 px-4"
          render={<Link to="/admin" />}
        >
          Admin home
        </Button>
        <Button
          nativeButton={false}
          role="link"
          variant="outline"
          className="min-h-11 px-4"
          render={<Link to="/technician" />}
        >
          Technician home
        </Button>
      </div>
    </div>
  )
}
