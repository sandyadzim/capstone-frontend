import { z } from 'zod'

export const residentUnitSchema = z.object({
  unit: z
    .object({
      id: z.uuid(),
      unitNumber: z.string().min(1).max(40),
      floor: z.number().int().min(-32768).max(32767),
    })
    .nullable(),
})
