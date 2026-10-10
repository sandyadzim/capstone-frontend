import { z } from 'zod'
import { ApiError } from '@/lib/api/error'
import { accountFormSchema } from './account-schema'

const fieldIssueSchema = z.object({
  path: z.tuple([accountFormSchema.keyof()]),
  message: z.string(),
})

export function accountFieldErrors(error: unknown) {
  if (!(error instanceof ApiError)) return []
  if (
    error.code === 'CONFLICT' &&
    error.message === 'Login identifier is already in use'
  )
    return [
      {
        path: ['loginIdentifier'] as const,
        message: 'This login ID is already in use. Choose another.',
      },
    ]
  if (error.code !== 'VALIDATION_ERROR') return []
  // Unknown fields and malformed details cannot become form errors.
  const details = z
    .object({ issues: z.array(z.unknown()) })
    .safeParse(error.details)
  if (!details.success) return []
  return details.data.issues.flatMap((issue) => {
    const parsed = fieldIssueSchema.safeParse(issue)
    return parsed.success ? [parsed.data] : []
  })
}
