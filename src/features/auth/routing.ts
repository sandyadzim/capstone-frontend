import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { Actor } from './schema'
import { sessionExpired, sessionQueryOptions } from './session'

export const roleHome = {
  ADMIN: '/admin',
  TECHNICIAN: '/technician',
  RESIDENT: '/',
} as const

function unsafeCharacters(value: string) {
  return [...value].some(
    (character) => character === '\\' || character.charCodeAt(0) <= 32,
  )
}

export function safeRedirect(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    unsafeCharacters(value)
  )
    return undefined
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith('//') || unsafeCharacters(decoded)) return undefined
    const url = new URL(value, 'https://property.invalid')
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '')
    if (
      url.origin !== 'https://property.invalid' ||
      path.toLowerCase() === '/login'
    )
      return undefined
    return url.pathname + url.search + url.hash
  } catch {
    return undefined
  }
}

export function loginSearch(search: Record<string, unknown>) {
  return {
    redirect: safeRedirect(search.redirect),
    reason: search.reason === 'expired' ? ('expired' as const) : undefined,
  }
}

export class PortalAccessError extends Error {
  readonly actor: Actor
  constructor(actor: Actor) {
    super('Access denied')
    this.actor = actor
  }
}

export async function requirePortal(
  client: QueryClient,
  role: Actor['role'],
  href: string,
) {
  const actor = await client.fetchQuery(sessionQueryOptions(client))
  if (!actor)
    throw redirect({
      to: '/login',
      search: {
        redirect: safeRedirect(href),
        reason: sessionExpired(client) ? 'expired' : undefined,
      },
      replace: true,
    })
  if (actor.role !== role) throw new PortalAccessError(actor)
  return { actor }
}

export async function requireGuest(client: QueryClient, target?: string) {
  const actor = await client.fetchQuery(sessionQueryOptions(client))
  if (actor)
    throw redirect({
      href: safeRedirect(target) ?? roleHome[actor.role],
      replace: true,
    })
}
