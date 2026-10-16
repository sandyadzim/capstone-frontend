import { useEffect, useRef } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReportPhoto } from '@/features/admin/reports/report-schema'
import { receiptFileError } from './completion-schema'

function savedFilename(saved: ReportPhoto | null) {
  if (!saved) return undefined
  try {
    return decodeURIComponent(
      new URL(saved.fileUrl).pathname.split('/').at(-1) || 'Saved receipt',
    )
  } catch {
    return 'Saved receipt'
  }
}

export function CompletionReceiptField({
  saved,
  file,
  onChange,
  disabled,
  error,
  onError,
}: {
  saved: ReportPhoto | null
  file?: File
  onChange: (file?: File) => void
  disabled: boolean
  error?: string
  onError: (message?: string) => void
}) {
  const preview = useRef<HTMLAnchorElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const filename = file?.name ?? savedFilename(saved) ?? 'No file chosen'
  useEffect(() => {
    if (!file) {
      if (input.current) input.current.value = ''
      return
    }
    const url = URL.createObjectURL(file)
    if (preview.current) preview.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <section
      aria-labelledby="work-receipt-heading"
      className="space-y-4 border-t pt-6"
    >
      <h2 id="work-receipt-heading" className="text-lg font-semibold">
        Receipt
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Required, including zero-cost work.
      </p>
      <div className="space-y-2">
        <label htmlFor="work-receipt" className="block text-sm font-medium">
          {saved ? 'Replace receipt (optional)' : 'Choose receipt'}
        </label>
        <div className="flex items-center gap-3">
          <div className="relative flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border border-input px-3 py-2 text-sm focus-within:outline-2 focus-within:outline-ring has-aria-invalid:border-destructive has-disabled:opacity-50">
            <span
              aria-hidden="true"
              className="shrink-0 rounded-md bg-accent px-2 py-1 text-accent-foreground"
            >
              Choose File
            </span>
            <span
              id="work-receipt-filename"
              title={filename}
              className="min-w-0 truncate"
            >
              {filename}
            </span>
            <input
              ref={input}
              id="work-receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={disabled}
              aria-invalid={!!error}
              aria-describedby={`work-receipt-filename work-receipt-help${error ? ' work-receipt-error' : ''}`}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              onChange={(event) => {
                const next = event.target.files?.[0]
                if (next) {
                  const issue = receiptFileError(next)
                  onError(issue)
                  if (issue) event.target.value = ''
                  else onChange(next)
                }
              }}
            />
          </div>
          {(file || saved) && (
            <Button
              nativeButton={false}
              role="link"
              variant="outline"
              className="min-h-11 shrink-0"
              disabled={disabled}
              render={
                <a
                  ref={preview}
                  href={file ? undefined : saved?.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Preview receipt (opens in new tab)"
                />
              }
            >
              Preview
              <ExternalLink aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
        <p
          id="work-receipt-help"
          className="text-sm leading-6 text-muted-foreground"
        >
          JPEG, PNG, WebP or PDF. Maximum 5 MiB.
        </p>
        {error && (
          <p
            id="work-receipt-error"
            role="alert"
            className="text-sm text-destructive-text"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
