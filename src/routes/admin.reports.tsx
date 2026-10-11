import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from '@tanstack/react-router'
import { reportsSearchSchema } from '@/features/admin/reports/report-schema'

export const Route = createFileRoute('/admin/reports')({
  validateSearch: reportsSearchSchema,
  search: { middlewares: [stripSearchParams(reportsSearchSchema.parse({}))] },
  head: () => ({ meta: [{ title: 'Reports · Admin · Property' }] }),
  component: Outlet,
})
