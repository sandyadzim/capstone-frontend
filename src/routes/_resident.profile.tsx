import { createFileRoute } from '@tanstack/react-router'
import { ResidentProfile } from '@/features/resident/resident-profile'

export const Route = createFileRoute('/_resident/profile')({
  head: () => ({ meta: [{ title: 'Profile · Property' }] }),
  component: ResidentProfile,
})
