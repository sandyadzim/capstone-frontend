import { createFileRoute } from '@tanstack/react-router'
import { TechnicianTaskDetail } from '@/features/technician/technician-task-detail'

import { technicianTaskSourceSchema } from '@/features/technician/technician-tasks-search'

export const Route = createFileRoute('/technician/tasks/$reportId')({
  validateSearch: technicianTaskSourceSchema,
  head: () => ({ meta: [{ title: 'Task details · Technician · Property' }] }),
  component: TechnicianTaskDetail,
})
