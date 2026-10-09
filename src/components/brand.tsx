import { Building2 } from 'lucide-react'

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2 aria-hidden="true" className="size-4" />
      </span>
      <span className="text-base font-semibold tracking-tight">Property</span>
    </span>
  )
}
