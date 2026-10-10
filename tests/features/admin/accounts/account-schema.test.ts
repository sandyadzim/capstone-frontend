import { expect, it } from 'vitest'
import {
  accountCreateSchema,
  accountFormSchema,
  accountsSearchSchema,
} from '@/features/admin/accounts/account-schema'

const creation = {
  name: ' Alex ',
  loginIdentifier: ' USER-ALEX ',
  password: '  password12  ',
  role: 'RESIDENT',
  isActive: true,
}

it('normalizes identity fields, preserves the password and strips non-payload fields', () => {
  expect(
    accountCreateSchema.parse({
      ...creation,
      confirmPassword: creation.password,
      unitId: 'ignored',
    }),
  ).toEqual({
    ...creation,
    name: 'Alex',
    loginIdentifier: 'user-alex',
  })
  expect(
    accountCreateSchema.parse({
      ...creation,
      name: 'a'.repeat(160),
      loginIdentifier: 'A'.repeat(254),
      password: 'p'.repeat(30),
      isActive: false,
    }),
  ).toMatchObject({ isActive: false })
  // Lowercasing can expand Unicode identifiers; measure after normalization.
  expect(
    accountCreateSchema.safeParse({
      ...creation,
      loginIdentifier: 'İ'.repeat(128),
    }).success,
  ).toBe(false)
})

it.each([4, 30])(
  'accepts a %i-character password with matching confirmation',
  (length) => {
    const password = ` ${'p'.repeat(length - 2)} `
    expect(
      accountFormSchema.parse({
        ...creation,
        password,
        confirmPassword: password,
      }).password,
    ).toBe(password)
  },
)

it.each([
  ['name', '   '],
  ['name', 'a'.repeat(161)],
  ['loginIdentifier', '  '],
  ['loginIdentifier', 'a'.repeat(255)],
  ['password', 'p'.repeat(3)],
  ['password', 'p'.repeat(31)],
  ['role', undefined],
  ['role', 'OWNER'],
  ['isActive', 'true'],
])('rejects invalid creation field %s', (field, value) => {
  expect(
    accountCreateSchema.safeParse({ ...creation, [field]: value }).success,
  ).toBe(false)
})

it('requires confirmation to match exactly without trimming either password', () => {
  expect(
    accountFormSchema.safeParse({
      ...creation,
      confirmPassword: creation.password,
    }).success,
  ).toBe(true)
  for (const confirmPassword of [
    '',
    creation.password.trim(),
    'different123',
    'p'.repeat(31),
  ]) {
    const result = accountFormSchema.safeParse({ ...creation, confirmPassword })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === 'confirmPassword',
        ),
      ).toBe(true)
  }
})

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
