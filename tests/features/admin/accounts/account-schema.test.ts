import { expect, it } from 'vitest'
import { accountsSearchSchema } from '@/features/admin/accounts/account-schema'

it('recovers invalid URL filters and pagination to the list defaults', () => {
  expect(
    accountsSearchSchema.parse({
      role: 'OWNER',
      isActive: '1',
      q: 'a'.repeat(255),
      page: -1,
      pageSize: 17,
    }),
  ).toEqual({
    role: undefined,
    isActive: undefined,
    q: '',
    page: 1,
    pageSize: 20,
  })
  expect(
    accountsSearchSchema.parse({ page: Number.MAX_SAFE_INTEGER, pageSize: 100 })
      .page,
  ).toBe(1)
})

it('restores bookmarked role, status, trimmed search, page and size', () => {
  expect(
    accountsSearchSchema.parse({
      role: 'TECHNICIAN',
      q: ' Alex ',
      isActive: 'false',
      page: '3',
      pageSize: '50',
    }),
  ).toEqual({
    role: 'TECHNICIAN',
    q: 'Alex',
    isActive: 'false',
    page: 3,
    pageSize: 50,
  })
  expect(accountsSearchSchema.parse({ q: 'a'.repeat(254) }).q).toHaveLength(254)
})

it('normalizes scalar values decoded by Router without dropping status or numeric search', () => {
  expect(accountsSearchSchema.parse({ q: 123, isActive: true })).toMatchObject({
    q: '123',
    isActive: 'true',
  })
  expect(
    accountsSearchSchema.parse({ q: true, isActive: false }),
  ).toMatchObject({ q: 'true', isActive: 'false' })
})
