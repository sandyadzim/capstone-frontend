import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/admin/settings/pages/settings-page'

export const Route = createFileRoute('/admin/settings')({
  head: () => ({ meta: [{ title: 'Settings · Admin · Property' }] }),
  component: SettingsPage,
})
