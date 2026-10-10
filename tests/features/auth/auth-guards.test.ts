import { afterEach, expect, it } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import {
  requireGuest,
  requirePortal,
  safeRedirect,
  loginSearch,
  PortalAccessError,
} from '@/features/auth/auth-guards'
import { sessionKey } from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'

const clients: ReturnType<typeof createQueryClient>[] = []
afterEach(() => {
  clients.forEach((client) => client.clear())
  clients.length = 0
})
function clientWith(actor: Actor | null) {
  const client = createQueryClient()
  clients.push(client)
  client.setQueryData(sessionKey, actor)
  return client
}
const actor: Actor = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Admin',
  loginIdentifier: 'admin',
  role: 'ADMIN',
}
it.each([
  'https://evil.test',
  '//evil.test',
  '/\\evil.test',
  '/%2fexample',
  '/%5cevil.test',
  '/login',
  '/login/',
  '/LOGIN',
  '/admin/../login',
  '/%6cogin?redirect=/admin',
  '/bad%0apath',
  '/bad path',
  '/bad%',
  null,
  1,
])('rejects unsafe or recursive return destinations: %j', (value) => {
  expect(safeRedirect(value)).toBeUndefined()
})
it('retains internal query/hash destinations and validates login search without exposing arbitrary params', () => {
  expect(safeRedirect('/admin/examples/form?from=home#request')).toBe(
    '/admin/examples/form?from=home#request',
  )
  expect(
    loginSearch({ redirect: '//evil.test', reason: 'forged', extra: 1 }),
  ).toEqual({ redirect: undefined, reason: undefined })
  expect(loginSearch({ redirect: '/technician', reason: 'expired' })).toEqual({
    redirect: '/technician',
    reason: 'expired',
  })
})
it.each(['ADMIN', 'TECHNICIAN', 'RESIDENT'] as const)(
  'permits only its own portal for %s',
  async (role) => {
    const client = clientWith({ ...actor, role })
    await expect(requirePortal(client, role, '/')).resolves.toEqual({
      actor: { ...actor, role },
    })
    const different = role === 'ADMIN' ? 'RESIDENT' : 'ADMIN'
    await expect(
      requirePortal(client, different, '/admin'),
    ).rejects.toBeInstanceOf(PortalAccessError)
  },
)
it('redirects guests before rendering child routes and preserves the requested address', async () => {
  const client = clientWith(null)
  await expect(
    requirePortal(client, 'ADMIN', '/admin/examples/form?from=home#request'),
  ).rejects.toMatchObject({
    options: {
      to: '/login',
      replace: true,
      search: { redirect: '/admin/examples/form?from=home#request' },
    },
  })
  await expect(requireGuest(client)).resolves.toBeUndefined()
})
it('redirects an existing session to its role home or requested internal destination', async () => {
  const client = clientWith(actor)
  await expect(requireGuest(client, '//evil.test')).rejects.toMatchObject({
    options: { href: '/admin', replace: true },
  })
  await expect(requireGuest(client, '/technician')).rejects.toMatchObject({
    options: { href: '/technician', replace: true },
  })
})
