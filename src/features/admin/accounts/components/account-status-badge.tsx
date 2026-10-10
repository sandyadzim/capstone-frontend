import { Badge } from '@/components/ui/badge'

export function AccountStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={
        active
          ? 'bg-status-occupied text-status-occupied-foreground'
          : undefined
      }
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}
