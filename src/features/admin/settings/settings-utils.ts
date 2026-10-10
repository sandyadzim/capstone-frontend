import { ApiError } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'

export function logoFileError(
  file: Pick<File, 'size' | 'type'>,
): string | undefined {
  if (file.size === 0) return 'Choose a nonempty image file.'
  if (file.size > 5 * 1024 * 1024)
    return 'Choose an image no larger than 5 MiB.'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Choose a JPEG, PNG, or WebP image.'
}

export function settingsErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 404)
      return 'The configured property is unavailable. Ask your administrator to check property setup, then try again.'
    if (error.statusCode === 403)
      return 'You do not have permission to access or change this property from this session. Contact your administrator.'
    if (error.statusCode === 400)
      return 'Check your property details or image, then try again.'
  }
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Try again.'
}

export function showSettingsError(title: string, error: unknown) {
  toast.add({
    title,
    description: settingsErrorMessage(error),
    type: 'error',
    priority: 'high',
  })
}
