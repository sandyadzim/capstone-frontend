import { describe, expect, it } from 'vitest'
import { maintenanceExampleSchema } from '@/features/maintenance-example/schema'

const validValues = {
  title: 'Leaking tap',
  description: 'The kitchen tap leaks.',
}

describe('maintenance example validation', () => {
  it('trims both fields before returning a valid submission', () => {
    expect(
      maintenanceExampleSchema.parse({
        title: '  Leaking tap  ',
        description: '\n The kitchen tap leaks. \n',
      }),
    ).toEqual(validValues)
  })

  it.each([
    { title: 'a'.repeat(5), description: 'b'.repeat(10) },
    { title: 'a'.repeat(100), description: 'b'.repeat(1000) },
  ])('accepts inclusive length boundaries', (values) => {
    expect(maintenanceExampleSchema.safeParse(values).success).toBe(true)
  })

  it.each([
    ['title', '', 'at least 5'],
    ['title', '     ', 'at least 5'],
    ['title', 'four', 'at least 5'],
    ['title', 'a'.repeat(101), '100 characters or fewer'],
    ['description', '', 'at least 10'],
    ['description', '          ', 'at least 10'],
    ['description', 'a'.repeat(9), 'at least 10'],
    ['description', 'a'.repeat(1001), '1,000 characters or fewer'],
  ])('reports an error on %s for invalid input', (field, value, message) => {
    const result = maintenanceExampleSchema.safeParse({
      ...validValues,
      [field]: value,
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected validation to fail')
    expect(result.error.issues).toEqual([
      expect.objectContaining({
        path: [field],
        message: expect.stringContaining(message),
      }),
    ])
  })

  it.each([null, {}, { title: 123, description: false }])(
    'rejects missing or non-string fields',
    (values) => {
      expect(maintenanceExampleSchema.safeParse(values).success).toBe(false)
    },
  )
})
