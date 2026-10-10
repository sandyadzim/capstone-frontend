import { expect, it } from 'vitest'
import { ApiError } from '@/lib/api/error'
import {
  unitCreateSchema,
  unitFormSchema,
  unitPatchSchema,
  unitsSearchSchema,
} from '@/features/admin/units/unit-schema'
import {
  changedUnitFields,
  unitFieldErrors,
} from '@/features/admin/units/unit-utils'
import { unit } from './fixtures'

it.each([-32768, -1, 0, 32767])(
  'accepts the signed integer floor %i',
  (floor) => {
    expect(
      unitFormSchema.parse({
        unitNumber: ' A-101 ',
        floor: String(floor),
        maintenanceFlag: false,
      }),
    ).toEqual({ unitNumber: 'A-101', floor, maintenanceFlag: false })
  },
)
it.each(['', '1.5', '32768', '-32769', '1e2'])(
  'rejects invalid floor %j',
  (floor) => {
    expect(
      unitFormSchema.safeParse({
        unitNumber: 'A-101',
        floor,
        maintenanceFlag: false,
      }).success,
    ).toBe(false)
  },
)
it('trims without changing case, supplies the create default, and enforces unit-number limits', () => {
  expect(unitCreateSchema.parse({ unitNumber: ' a-101 ', floor: 0 })).toEqual({
    unitNumber: 'a-101',
    floor: 0,
    maintenanceFlag: false,
  })
  for (const unitNumber of ['', ' ', 'a'.repeat(41)])
    expect(unitCreateSchema.safeParse({ unitNumber, floor: 0 }).success).toBe(
      false,
    )
  expect(
    unitCreateSchema.safeParse({ unitNumber: 'a'.repeat(40), floor: 0 })
      .success,
  ).toBe(true)
})
it('requires nonempty strict patches without defaulting an omitted maintenance flag', () => {
  expect(unitPatchSchema.parse({ floor: 0 })).toEqual({ floor: 0 })
  expect(unitPatchSchema.parse({ maintenanceFlag: false })).toEqual({
    maintenanceFlag: false,
  })
  expect(unitPatchSchema.safeParse({}).success).toBe(false)
  expect(unitPatchSchema.safeParse({ isArchived: true }).success).toBe(false)
})
it('returns only changed fields, including zero and false', () => {
  expect(changedUnitFields(unit, { ...unit, floor: 0 })).toEqual({ floor: 0 })
  expect(
    changedUnitFields(
      { ...unit, maintenanceFlag: true },
      { ...unit, maintenanceFlag: false },
    ),
  ).toEqual({ maintenanceFlag: false })
  expect(changedUnitFields(unit, unit)).toEqual({})
})
it('normalizes invalid URL values and keeps independent pagination', () => {
  expect(
    unitsSearchSchema.parse({
      page: '0',
      pageSize: '999',
      isArchived: 'yes',
      residentPage: '2',
      historyPage: '3',
    }),
  ).toMatchObject({
    page: 1,
    pageSize: 20,
    isArchived: false,
    residentPage: 2,
    historyPage: 3,
  })
  expect(unitsSearchSchema.parse({ page: '9007199254740991' }).page).toBe(1)
  expect(unitsSearchSchema.parse({ isArchived: 'true' }).isArchived).toBe(true)
})
it('maps only validated known top-level field errors', () => {
  const error = new ApiError('Invalid', 'VALIDATION_ERROR', 400, {
    issues: [
      { path: ['floor'], message: 'Invalid floor' },
      { path: ['unknown'], message: 'Unknown' },
      { path: ['unitNumber', 0], message: 'Nested' },
    ],
  })
  expect(unitFieldErrors(error)).toEqual([
    { path: ['floor'], message: 'Invalid floor' },
  ])
  expect(
    unitFieldErrors(
      new ApiError('Invalid', 'VALIDATION_ERROR', 400, { issues: [{}] }),
    ),
  ).toEqual([])
})
it('preserves editable search whitespace and rejects invalid or oversized URL searches', () => {
  expect(unitsSearchSchema.parse({ q: ' A 10 ' }).q).toBe(' A 10 ')
  expect(unitsSearchSchema.parse({ q: 'a'.repeat(40) }).q).toHaveLength(40)
  expect(unitsSearchSchema.parse({ q: 'a'.repeat(41) }).q).toBe('')
  expect(unitsSearchSchema.parse({ q: ['a', 'b'] }).q).toBe('')
  expect(unitsSearchSchema.parse({}).q).toBe('')
})

it('accepts optional display statuses and normalizes invalid URL status values', () => {
  for (const displayStatus of ['VACANT', 'OCCUPIED', 'MAINTENANCE'])
    expect(unitsSearchSchema.parse({ displayStatus }).displayStatus).toBe(
      displayStatus,
    )
  for (const displayStatus of [
    undefined,
    null,
    '',
    'vacant',
    ['VACANT', 'OCCUPIED'],
  ])
    expect(unitsSearchSchema.parse({ displayStatus }).displayStatus).toBeNull()
})
