import { createFileRoute } from '@tanstack/react-router'
import { AdminHome } from '@/components/portal-home'

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Admin · Property' }] }),
  component: AdminHome,
})
