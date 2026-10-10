import { createFileRoute } from '@tanstack/react-router'
import { UnitsPage } from '@/features/admin/units/pages/units-page'
export const Route = createFileRoute('/admin/units/')({ component: UnitsPage })
