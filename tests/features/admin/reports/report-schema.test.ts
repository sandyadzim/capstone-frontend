import { expect, it } from 'vitest'
import {
  reportsSearchSchema,
  reportDateRangeError,
} from '@/features/admin/reports/report-schema'

it('normalizes search and pagination and keeps supported filters', () => {
  expect(
    reportsSearchSchema.parse({
      q: '  AC%_\\  ',
      status: 'IN_PROGRESS',
      category: 'AC',
      priority: 'HIGH',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-11',
      page: '2',
      pageSize: '50',
      ignored: 'field',
    }),
  ).toEqual({
    q: 'AC%_\\',
    status: 'IN_PROGRESS',
    category: 'AC',
    priority: 'HIGH',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-11',
    page: 2,
    pageSize: 50,
  })
})

it('falls back safely for malformed URL values', () => {
  expect(
    reportsSearchSchema.parse({
      q: 'x'.repeat(161),
      status: 'OPEN',
      category: 'BAD',
      priority: 'URGENT',
      dateFrom: '2026-02-30',
      dateTo: 'not a date',
      page: 0,
      pageSize: 30,
    }),
  ).toEqual({ q: '', page: 1, pageSize: 20 })
  expect(
    reportsSearchSchema.parse({ page: Number.MAX_SAFE_INTEGER }).page,
  ).toBe(1)
  expect(reportsSearchSchema.parse({ q: 123 }).q).toBe('123')
})

it.each([
  '2026-10-1',
  '2026-13-01',
  '2025-02-29',
  '2026-04-31',
  '2026-10-01T00:00:00Z',
  '10000-01-01',
])('omits an invalid calendar date %s', (dateFrom) => {
  expect(reportsSearchSchema.parse({ dateFrom }).dateFrom).toBeUndefined()
})

it('accepts individual, equal and leap-day boundaries and preserves reversed dates for field feedback', () => {
  for (const values of [
    {},
    { dateFrom: '2026-10-01' },
    { dateTo: '2026-10-11' },
    { dateFrom: '2024-02-29', dateTo: '2024-02-29' },
  ])
    expect(
      reportDateRangeError(reportsSearchSchema.parse(values)),
    ).toBeUndefined()
  const reversed = reportsSearchSchema.parse({
    dateFrom: '2026-10-11',
    dateTo: '2026-10-01',
  })
  expect(reversed.dateFrom).toBe('2026-10-11')
  expect(reportDateRangeError(reversed)).toBe(
    'Start date must be on or before end date.',
  )
})
