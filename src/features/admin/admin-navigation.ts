export { accountsSearchSchema } from './accounts/account-schema'

export const accountRoles = {
  RESIDENT: 'Residents',
  TECHNICIAN: 'Technicians',
  ADMIN: 'Administrators',
} as const

export function adminPageTitle(pathname: string, role?: string) {
  if (pathname === '/admin/accounts/new') return 'Create account'
  if (pathname.startsWith('/admin/accounts/'))
    return pathname.endsWith('/edit') ? 'Edit account' : 'Account details'
  if (pathname === '/admin/accounts') {
    const label = accountRoles[role as keyof typeof accountRoles]
    return `Accounts / ${label ?? 'All accounts'}`
  }
  if (pathname === '/admin/settings') return 'Settings'
  if (pathname === '/admin/reports') return 'Reports'
  if (pathname === '/admin/units/new') return 'Create Unit'
  if (pathname.startsWith('/admin/units/')) {
    if (pathname.endsWith('/edit')) return 'Edit Unit'
    if (pathname.endsWith('/resident')) return 'Resident Placement'
    if (/\/history\/?$/.test(pathname)) return 'Maintenance History'
    if (pathname.includes('/history/')) return 'History Details'
    return 'Unit Details'
  }
  if (pathname === '/admin/units') return 'Units'
  if (pathname === '/admin/examples/form') return 'Example form'
  return 'Dashboard'
}
