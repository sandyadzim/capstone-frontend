import { useEffect, useRef, useState } from 'react'
import { Search, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { imageFileError, imageMimeTypes } from '@/lib/image-file'

export function LocalImagePreview({
  file,
  className,
  alt = `Selected image: ${file.name}`,
}: {
  file: File
  className?: string
  alt?: string
}) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const next = URL.createObjectURL(file)
    if (image.current) image.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [file])
  return (
    <img
      ref={image}
      alt={alt}
      className={cn(
        'h-24 w-full rounded-md object-contain bg-muted',
        className,
      )}
    />
  )
}

export function ImageUploadField({
  id,
  label,
  files,
  disabled = false,
  maxFiles,
  maxSizeMiB,
  onChange,
}: {
  id: string
  label: string
  files: File[]
  disabled?: boolean
  maxFiles: number
  maxSizeMiB: number
  onChange: (files: File[]) => void
}) {
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ul
        className="grid grid-cols-[repeat(auto-fill,8rem)] gap-3"
        aria-label={`${label} tiles`}
      >
        {files.map((file, index) => (
          <li
            key={index}
            className="group relative aspect-square min-w-0 overflow-hidden rounded-lg border bg-muted"
          >
            <LocalImagePreview
              file={file}
              className="size-full rounded-none object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 bg-background"
                      aria-label={`Preview image ${index + 1}: ${file.name}`}
                    />
                  }
                >
                  <Search aria-hidden="true" />
                </DialogTrigger>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl motion-reduce:animate-none!">
                  <DialogHeader className="pr-12">
                    <DialogTitle>Image preview</DialogTitle>
                    <DialogDescription className="wrap-anywhere">
                      {file.name}
                    </DialogDescription>
                  </DialogHeader>
                  <LocalImagePreview
                    file={file}
                    className="max-h-[60dvh] h-auto w-full object-contain"
                  />
                </DialogContent>
              </Dialog>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 bg-background"
                disabled={disabled}
                aria-label={`Remove image ${index + 1}: ${file.name}`}
                onClick={() => {
                  onChange(files.filter((_, i) => i !== index))
                  setError(undefined)
                  requestAnimationFrame(() => input.current?.focus())
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <p
              className="absolute right-0 bottom-0 left-0 truncate border-t bg-background px-2 py-1 text-xs"
              title={file.name}
            >
              {file.name}
            </p>
          </li>
        ))}
        <li
          className={cn(
            'relative flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary has-disabled:opacity-50',
            files.length >= maxFiles && 'hidden',
          )}
        >
          <Plus aria-hidden="true" className="size-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Add image</span>
          <input
            ref={input}
            id={id}
            type="file"
            multiple
            accept={imageMimeTypes.join(',')}
            disabled={disabled || files.length >= maxFiles}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-invalid={!!error}
            aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? [])
              const issue =
                files.length + selected.length > maxFiles
                  ? `Choose up to ${maxFiles} ${maxFiles === 1 ? 'image' : 'images'}.`
                  : selected
                      .map((file) => imageFileError(file, maxSizeMiB))
                      .find(Boolean)
              setError(issue)
              if (!issue) onChange([...files, ...selected])
              event.target.value = ''
            }}
          />
        </li>
      </ul>
      <p id={`${id}-help`} className="text-sm leading-6 text-muted-foreground">
        Up to {maxFiles} JPEG, PNG, or WebP images. Maximum {maxSizeMiB} MiB
        each.
      </p>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  )
}
