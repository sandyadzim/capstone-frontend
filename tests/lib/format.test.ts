import { expect, it } from 'vitest'
import { formatIdr } from '@/lib/format'

it('formats IDR with two decimals without losing large-value precision', () => {
  expect(formatIdr('125000.50')).toBe('Rp 125.000,50')
  expect(formatIdr('0.00')).toBe('Rp 0,00')
  expect(formatIdr('9007199254740993.01')).toBe('Rp 9.007.199.254.740.993,01')
})
