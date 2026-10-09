import { z } from 'zod'

export const maintenanceExampleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Enter a title with at least 5 characters.')
    .max(100, 'Keep the title to 100 characters or fewer.'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the issue in at least 10 characters.')
    .max(1_000, 'Keep the description to 1,000 characters or fewer.'),
})

export type MaintenanceExampleValues = z.infer<typeof maintenanceExampleSchema>
