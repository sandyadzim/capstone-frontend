import { createFileRoute } from '@tanstack/react-router'
import { TechnicianTaskDetail } from '@/features/technician/technician-task-detail'

export const Route = createFileRoute('/technician/tasks/$reportId')({
  head: () => ({ meta: [{ title: 'Task details · Technician · Property' }] }),
  component: TechnicianTaskDetail,
})
