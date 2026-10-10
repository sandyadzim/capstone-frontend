import { Building2 } from 'lucide-react'

export function Brand({
  compact = false,
  name = 'Property',
}: {
  compact?: boolean
  name?: string
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2 aria-hidden="true" className="size-4" />
      </span>
      {!compact && (
        <span className="line-clamp-2 min-w-0 text-left text-base leading-5 font-semibold tracking-tight wrap-anywhere">
          {name}
        </span>
      )}
    </span>
  )
}
