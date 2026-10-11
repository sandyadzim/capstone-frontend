import { Badge } from '@/components/ui/badge'
import { reportPriorityLabels, reportStatusLabels } from '../report-labels'
import type { ReportListItem } from '../report-schema'

const statusStyles = {
  REPORTED: '',
  VERIFIED: '',
  REJECTED: 'bg-destructive/10 text-destructive-text',
  ASSIGNED: 'bg-status-vacant text-status-vacant-foreground',
  IN_PROGRESS: 'bg-status-maintenance text-status-maintenance-foreground',
  COMPLETED: 'bg-status-occupied text-status-occupied-foreground',
  CLOSED: 'bg-status-occupied text-status-occupied-foreground',
}

const priorityStyles = {
  LOW: '',
  MEDIUM: 'bg-status-maintenance text-status-maintenance-foreground',
  HIGH: 'bg-destructive/10 text-destructive-text',
}

export function ReportStatusBadge({
  status,
}: {
  status: ReportListItem['status']
}) {
  return (
    <Badge variant="secondary" className={statusStyles[status]}>
      {reportStatusLabels[status]}
    </Badge>
  )
}

export function ReportPriorityBadge({
  priority,
}: {
  priority: ReportListItem['finalPriority']
}) {
  if (!priority) return <span>—</span>
  return (
    <Badge variant="secondary" className={priorityStyles[priority]}>
      {reportPriorityLabels[priority]}
    </Badge>
  )
}
