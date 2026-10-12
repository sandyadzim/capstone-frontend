import { createFileRoute } from '@tanstack/react-router'
import { ResidentHome } from '@/features/resident/resident-home'

export const Route = createFileRoute('/_resident/')({
  head: () => ({ meta: [{ title: 'Resident · Property' }] }),
  component: ResidentHome,
})
