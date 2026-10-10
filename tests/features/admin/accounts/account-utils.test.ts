import { expect, it } from 'vitest'
import { ApiError } from '@/lib/api/error'
import { accountFieldErrors } from '@/features/admin/accounts/account-utils'

it('maps duplicate Login ID and validates individual backend field issues', () => {
  expect(
    accountFieldErrors(
      new ApiError('Login identifier is already in use', 'CONFLICT', 409),
    ),
  ).toEqual([
    {
      path: ['loginIdentifier'],
      message: 'This login ID is already in use. Choose another.',
    },
  ])
  expect(
    accountFieldErrors(
      new ApiError('Invalid', 'VALIDATION_ERROR', 400, {
        issues: [
          { path: ['name'], message: 'Bad name' },
          { path: ['role'], message: 'Bad role' },
          { path: ['unknown'], message: 'Unexpected' },
          { path: ['name', 'nested'], message: 'Unexpected' },
          { path: ['password'], message: 123 },
          null,
        ],
      }),
    ),
  ).toEqual([
    { path: ['name'], message: 'Bad name' },
    { path: ['role'], message: 'Bad role' },
  ])
})

it.each([
  new Error('failure'),
  new ApiError('Conflict', 'CONFLICT', 409),
  new ApiError('Invalid', 'VALIDATION_ERROR', 400, { issues: 'wrong' }),
  new ApiError('Invalid', 'VALIDATION_ERROR', 400),
])('ignores non-field or malformed failures', (error) => {
  expect(accountFieldErrors(error)).toEqual([])
})
