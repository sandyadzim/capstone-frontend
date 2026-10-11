export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp']

export function imageFileError(file: File, maxSizeMiB: number) {
  if (!imageMimeTypes.includes(file.type))
    return 'Choose a JPEG, PNG, or WebP image.'
  if (!file.size) return 'Choose a non-empty image.'
  if (file.size > maxSizeMiB * 1024 * 1024)
    return `Each image must be ${maxSizeMiB} MiB or smaller.`
}
