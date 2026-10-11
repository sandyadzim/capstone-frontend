import type { ReportListItem } from './report-schema'

export const reportStatusLabels = {
  REPORTED: 'Reported',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
} satisfies Record<ReportListItem['status'], string>

export const reportCategoryLabels = {
  AC: 'AC',
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  FURNITURE: 'Furniture',
  BUILDING: 'Building',
  OTHER: 'Other',
} satisfies Record<ReportListItem['category'], string>

export const reportPriorityLabels = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
} satisfies Record<NonNullable<ReportListItem['finalPriority']>, string>
