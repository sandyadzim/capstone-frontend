import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { RoutePending } from '@/components/route-states'
import { AuthLayout } from './auth-layout'
import { AccessDenied, SessionUnavailable } from './session-feedback'
import { sessionQueryOptions } from '../auth-session'
import type { Actor } from '../auth-schema'

export function ProtectedPortal({
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
      <AuthLayout>
        <RoutePending />
      </AuthLayout>
    )
  if (actor.role !== role) return <AccessDenied actor={actor} />
  return children(actor)
}
