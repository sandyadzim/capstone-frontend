import { z } from 'zod'

export const accountRoles = {
  RESIDENT: 'Residents',
  TECHNICIAN: 'Technicians',
  ADMIN: 'Administrators',
} as const

export const accountsSearchSchema = z.object({
  role: z.enum(['ADMIN', 'TECHNICIAN', 'RESIDENT']).optional().catch(undefined),
})

export function adminPageTitle(pathname: string, role?: string) {
  if (pathname === '/admin/accounts') {
    const label = accountRoles[role as keyof typeof accountRoles]
    return `Accounts / ${label ?? 'All accounts'}`
  }
  if (pathname === '/admin/settings') return 'Settings'
  if (pathname === '/admin/reports') return 'Reports'
  if (pathname === '/admin/units') return 'Units'
  if (pathname === '/admin/examples/form') return 'Example form'
  return 'Dashboard'
}
