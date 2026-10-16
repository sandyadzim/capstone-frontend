import { createFileRoute } from '@tanstack/react-router'
import { TechnicianCompletionPage } from '@/features/technician/technician-completion-page'

export const Route = createFileRoute('/technician/tasks/$reportId_/complete')({
  head: () => ({ meta: [{ title: 'Work results · Technician · Property' }] }),
  component: TechnicianCompletionPage,
})
