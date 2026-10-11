import { z } from 'zod'
import { ApiError } from '@/lib/api/error'
import { imageFileError } from '@/lib/image-file'
import { reportCreateSchema } from './report-schema'

export function damagePhotoError(file: File) {
  return imageFileError(file, 5)
}

const issueSchema = z.object({
  path: z.tuple([reportCreateSchema.keyof()]),
  message: z.string(),
})
export function reportFieldErrors(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR')
    return []
  const details = z
    .object({ issues: z.array(z.unknown()) })
    .safeParse(error.details)
  if (!details.success) return []
  return details.data.issues.flatMap((issue) => {
    const parsed = issueSchema.safeParse(issue)
    return parsed.success ? [parsed.data] : []
  })
}
