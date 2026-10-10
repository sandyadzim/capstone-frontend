import { Building2 } from 'lucide-react'
import { cn } from 'cn'

export function LoadingIndicator({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex flex-col items-center gap-4', className)}
    >
      <div className="flex size-16 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Building2 className="size-8" />
      </div>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-primary/10">
        <div className="loading-track h-full w-1/3 rounded-full bg-primary" />
      </div>
    </div>
  )
}
