import type { ReportListItem } from '@/features/admin/reports/report-schema'

export const residentReportStatusStyles = {
  REPORTED: 'bg-status-reported text-status-reported-foreground',
  VERIFIED: 'bg-status-verified text-status-verified-foreground',
  ASSIGNED: 'bg-status-assigned text-status-assigned-foreground',
  IN_PROGRESS: 'bg-status-maintenance text-status-maintenance-foreground',
  COMPLETED: 'bg-status-occupied text-status-occupied-foreground',
  CLOSED: 'bg-status-occupied text-status-occupied-foreground',
  REJECTED: 'bg-destructive/10 text-destructive-text',
} satisfies Record<ReportListItem['status'], string>

export const residentReportStatusHelp: Record<
  ReportListItem['status'],
  string
> = {
  REPORTED: 'Your report is waiting for administrator review.',
  VERIFIED:
    'Your report has been verified. A technician will be assigned next.',
  ASSIGNED: 'A technician has been assigned to your report.',
  IN_PROGRESS: 'Your report is being handled by the assigned technician.',
  COMPLETED: 'The work is complete and awaiting administrator review.',
  CLOSED: 'Your report has been closed by the administrator.',
  REJECTED: 'Your report was not approved. Read the reason below.',
}
