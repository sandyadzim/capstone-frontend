import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { RoutePending } from '@/components/route-states'
import { AuthShell } from './auth-shell'
import { useSignOut } from './use-sign-out'
import { PortalAccessError, roleHome } from './routing'
import { sessionQueryOptions } from './session'
import type { Actor } from './schema'

export function AccessDenied({ actor }: { actor: Actor }) {
  const logout = useSignOut()
  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        Access denied
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Your account does not have access to this portal. Continue to your own
        portal or sign out to use another account.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Button
          nativeButton={false}
          role="link"
          className="min-h-11 px-4"
          render={<Link to={roleHome[actor.role]} />}
        >
          Go to your portal
        </Button>
        <Button
          variant="outline"
          className="min-h-11 px-4"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </AuthShell>
  )
}

export function SessionUnavailable({
  retry,
  busy = false,
}: {
  retry: () => void
  busy?: boolean
}) {
  return (
    <AuthShell>
      <div role="alert">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Unable to check your session
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Check your connection and try again. Your portal will be available
          once your session is verified.
        </p>
      </div>
      <Button className="mt-8 min-h-11 px-4" disabled={busy} onClick={retry}>
        {busy ? 'Checking session…' : 'Try again'}
      </Button>
    </AuthShell>
  )
}

export function AuthRouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const client = useQueryClient()
  const session = useQuery(sessionQueryOptions(client))
  useEffect(() => {
    if (
      !session.isError &&
      session.data !== undefined &&
      (!(error instanceof PortalAccessError) ||
        session.data?.id !== error.actor.id ||
        session.data?.role !== error.actor.role)
    ) {
      router.clearCache()
      reset()
      void router.invalidate()
    }
  }, [session.data, session.isError, error, router, reset])
  if (!session.isError && error instanceof PortalAccessError && session.data)
    return <AccessDenied actor={session.data} />
  return (
    <SessionUnavailable
      busy={session.isFetching}
      retry={() => {
        void session.refetch()
      }}
    />
  )
}

export function PortalSession({
  role,
  children,
}: {
  role: Actor['role']
  children: (actor: Actor) => ReactNode
}) {
  const client = useQueryClient()
  const router = useRouter()
  const session = useQuery(sessionQueryOptions(client))
  const actor = session.data
  const identity = actor ? `${actor.id}:${actor.role}` : actor
  const previousIdentity = useRef(identity)
  useEffect(() => {
    const changed = previousIdentity.current !== identity
    previousIdentity.current = identity
    if (!session.isError && (identity === null || changed)) {
      router.clearCache()
      void router.invalidate()
    }
  }, [identity, router, session.isError])
  if (session.isError)
    return (
      <SessionUnavailable
        busy={session.isFetching}
        retry={() => {
          void session.refetch()
        }}
      />
    )
  if (!actor)
    return (
      <AuthShell>
        <RoutePending />
      </AuthShell>
    )
  if (actor.role !== role) return <AccessDenied actor={actor} />
  return children(actor)
}
