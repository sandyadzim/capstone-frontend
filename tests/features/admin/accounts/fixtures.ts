import type { Account } from '@/features/admin/accounts/account-schema'

export const account: Account = {
  id: '33000000-0000-4000-8000-000000000003',
  name: 'Alex Resident',
  loginIdentifier: 'alex@example.test',
  role: 'RESIDENT',
  isActive: true,
  activeUnit: {
    id: '55000000-0000-4000-8000-000000000002',
    unitNumber: 'B-202',
    floor: 2,
  },
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
}

export function accountPage<T>(
  data: T[],
  page = 1,
  pageSize = 20,
  total = data.length,
) {
  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}
