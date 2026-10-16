import { createFileRoute } from '@tanstack/react-router'
import { TechnicianCompletionPage } from '@/features/technician/technician-completion-page'

import { technicianTaskSourceSchema } from '@/features/technician/technician-tasks-search'

export const Route = createFileRoute('/technician/tasks/$reportId_/complete')({
  validateSearch: technicianTaskSourceSchema,
  head: () => ({ meta: [{ title: 'Work results · Technician · Property' }] }),
  component: TechnicianCompletionPage,
})
