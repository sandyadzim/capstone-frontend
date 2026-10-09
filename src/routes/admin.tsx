import { createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '@/layouts/admin-layout'

export const Route = createFileRoute('/admin')({ component: AdminLayout })
