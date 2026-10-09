import { createFileRoute } from '@tanstack/react-router'
import { ResidentLayout } from '@/layouts/mobile-layout'

export const Route = createFileRoute('/_resident')({
  component: ResidentLayout,
})
