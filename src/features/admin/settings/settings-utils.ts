import { getErrorMessage } from '@/lib/api/error'
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

export function showSettingsError(title: string, error: unknown) {
  toast.add({
    title,
    description: getErrorMessage(error),
    type: 'error',
    priority: 'high',
  })
}
