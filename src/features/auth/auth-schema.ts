import { z } from 'zod'

export const actorSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  loginIdentifier: z.string().min(1).max(254),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'RESIDENT']),
})

export const loginSchema = z.object({
  loginIdentifier: z
    .string()
    .trim()
    .min(1, 'Enter your login ID.')
    .max(254, 'Keep your login ID to 254 characters or fewer.'),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .max(1024, 'Keep your password to 1,024 characters or fewer.'),
})

export type Actor = z.infer<typeof actorSchema>
export type LoginValues = z.infer<typeof loginSchema>
