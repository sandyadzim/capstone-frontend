import type { Property } from '@/features/admin/settings/settings-schema'
import type { Actor } from '@/features/auth/auth-schema'

export const property: Property = {
  id: '11000000-0000-4000-8000-000000000001',
  name: 'Garden Residence',
  address: '12 Garden Street, Jakarta',
  logoUrl: null,
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
}
export const admin: Actor = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test Admin',
  loginIdentifier: 'admin',
  role: 'ADMIN',
}
