import { createFileRoute } from '@tanstack/react-router'
import { TechnicianTasksPage } from '@/features/technician/technician-tasks-page'

export const Route = createFileRoute('/technician/tasks/')({
  head: () => ({ meta: [{ title: 'Tasks · Technician · Property' }] }),
  component: TechnicianTasksPage,
})
