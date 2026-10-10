import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Building2, Expand, ImageUp, LoaderCircle } from 'lucide-react'
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
import type { Property } from '../settings-schema'
import { logoFileError, showSettingsError } from '../settings-utils'

function LogoPreview({
  url,
  selected,
}: {
  url: string | null
  selected: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (url && !failed)
    return (
      <Dialog>
        <DialogTrigger
          aria-label="Preview property logo"
          render={
            <Button
              variant="ghost"
              className="group relative h-20 w-28 shrink-0 border-border p-2 hover:border-primary hover:bg-transparent"
            />
          }
        >
          <img
            src={url}
            alt="Property logo"
            className="size-full object-contain"
            onError={() => setFailed(true)}
          />
          <Expand
            aria-hidden="true"
            className="absolute right-1 bottom-1 size-3 text-primary"
          />
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="pr-12">
            <DialogTitle>Property logo preview</DialogTitle>
            <DialogDescription>
              {selected
                ? 'Selected image · Not uploaded yet'
                : 'Current property logo'}
            </DialogDescription>
          </DialogHeader>
          <img
            src={url}
            alt="Enlarged property logo"
            className="h-auto max-h-[60dvh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    )
  return (
    <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border">
      <Building2
        aria-label="No logo preview available"
        className="size-8 text-muted-foreground"
      />
    </div>
  )
}

export function PropertyLogoForm({
  logoUrl,
  busy,
  uploading,
  removing,
  onUpload,
  onRemove,
}: {
  logoUrl: string | null
  busy: boolean
  uploading: boolean
  removing: boolean
  onUpload: (file: File) => Promise<Property | undefined>
  onRemove: () => Promise<Property | undefined>
}) {
  const [selection, setSelection] = useState<{
    file: File
    url: string
  } | null>(null)
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const preview = selection?.url ?? logoUrl

  useEffect(() => {
    const url = selection?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [selection])

  function clearSelection() {
    setSelection(null)
    setError(undefined)
    if (input.current) input.current.value = ''
  }

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const issue = logoFileError(file)
    setError(issue)
    setSelection(issue ? null : { file, url: URL.createObjectURL(file) })
  }

  async function uploadLogo() {
    if (busy || !selection) return
    try {
      if (await onUpload(selection.file)) clearSelection()
    } catch (error) {
      showSettingsError('Unable to upload logo', error)
    }
  }

  async function removeLogo() {
    if (busy || !logoUrl) return
    try {
      if (await onRemove()) clearSelection()
    } catch (error) {
      showSettingsError('Unable to remove logo', error)
    }
  }
  return (
    <div className="mt-5">
      <div className="flex items-center gap-4">
        <LogoPreview key={preview} url={preview} selected={!!selection} />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {selection
              ? 'Preview · Not uploaded yet'
              : logoUrl
                ? 'Current property logo'
                : 'No logo uploaded'}
          </p>
          {selection && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground wrap-anywhere">
              {selection.file.name}
            </p>
          )}
        </div>
      </div>
      <Field className="mt-5" data-invalid={!!error}>
        <FieldLabel htmlFor="property-logo" className="sr-only">
          Choose a logo
        </FieldLabel>
        <div className="relative flex min-h-24 items-center gap-4 rounded-lg border border-dashed border-input px-4 py-4 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary has-disabled:pointer-events-none has-disabled:opacity-50 has-aria-invalid:border-destructive">
          <ImageUp
            aria-hidden="true"
            className="size-6 shrink-0 text-primary"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              {selection ? 'Choose another image' : 'Choose image'}
            </p>
            <p
              id="property-logo-help"
              className="mt-1 text-sm leading-6 text-muted-foreground"
            >
              JPEG, PNG, or WebP. Maximum 5 MiB.
            </p>
          </div>
          <input
            ref={input}
            id="property-logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-invalid={!!error}
            aria-describedby={
              error
                ? 'property-logo-help property-logo-error'
                : 'property-logo-help'
            }
            onChange={selectLogo}
          />
        </div>
        {error && <FieldError id="property-logo-error">{error}</FieldError>}
      </Field>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          disabled={busy || !selection}
          className="min-h-11 px-4"
          aria-busy={uploading}
          onClick={uploadLogo}
        >
          {uploading && (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          )}
          {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
        </Button>
        {selection && (
          <Button
            variant="outline"
            disabled={busy}
            className="min-h-11 px-4"
            onClick={clearSelection}
          >
            Cancel selection
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy || !logoUrl}
          className="min-h-11 px-4"
          aria-busy={removing}
          onClick={removeLogo}
        >
          {removing && (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          )}
          {removing ? 'Removing…' : 'Remove logo'}
        </Button>
      </div>
    </div>
  )
}
