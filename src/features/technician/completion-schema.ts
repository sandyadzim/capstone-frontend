import { z } from 'zod'
import { reportDetailSchema } from '@/features/admin/reports/report-schema'
import { imageFileError, imageMimeTypes } from '@/lib/image-file'

const price = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,20})(?:\.\d{1,2})?$/,
    'Use up to 21 whole digits and 2 decimals.',
  )
export const completionFormSchema = z.object({
  inspectionResult: z.string().trim().min(1, 'Enter the inspection findings.'),
  problemFound: z.string().trim().min(1, 'Enter the problem found.'),
  repairAction: z.string().trim().min(1, 'Enter the repair action.'),
  additionalNotes: z.string().trim(),
  items: z.array(
    z.object({
      type: z.enum(['SERVICE', 'MATERIAL']),
      description: z
        .string()
        .trim()
        .min(1, 'Enter a description.')
        .max(240, 'Keep the description to 240 characters or fewer.'),
      price,
    }),
  ),
})
export type CompletionValues = z.infer<typeof completionFormSchema>

// The shared detail schema permits omitted resident-only cost data. This form
// must receive technician cost items before it can replace the saved list.
export const completionReportSchema = reportDetailSchema.extend({
  costItems: reportDetailSchema.shape.costItems.unwrap(),
})
export type CompletionReport = z.infer<typeof completionReportSchema>

export function completionDefaults(report: CompletionReport): CompletionValues {
  const result = report.maintenanceResult
  return {
    inspectionResult: result?.inspectionResult ?? '',
    problemFound: result?.problemFound ?? '',
    repairAction: result?.repairAction ?? '',
    additionalNotes: result?.additionalNotes ?? '',
    items: report.costItems.map(({ type, description, price }) => ({
      type,
      description,
      price,
    })),
  }
}

export function receiptFileError(file: File) {
  if (![...imageMimeTypes, 'application/pdf'].includes(file.type))
    return 'Choose a JPEG, PNG, WebP image or PDF.'
  if (!file.size) return 'Choose a non-empty receipt.'
  if (file.size > 5 * 1024 * 1024)
    return 'The receipt must be 5 MiB or smaller.'
}

export function completionFileError(
  report: CompletionReport,
  photos: File[],
  receipt?: File,
) {
  if (report.repairPhotos.length + photos.length > 5)
    return {
      field: 'photos' as const,
      message: 'Choose up to five repair photos, including saved photos.',
    }
  const photoError = photos.map((file) => imageFileError(file, 5)).find(Boolean)
  if (photoError) return { field: 'photos' as const, message: photoError }
  const receiptError = receipt
    ? receiptFileError(receipt)
    : !report.receipt
      ? 'Choose a receipt, even when there are no costs.'
      : undefined
  if (receiptError) return { field: 'receipt' as const, message: receiptError }
}
