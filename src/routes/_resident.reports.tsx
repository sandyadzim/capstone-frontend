import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from '@tanstack/react-router'
import { residentReportsSearchSchema } from '@/features/resident/resident-reports-search'

export const Route = createFileRoute('/_resident/reports')({
  validateSearch: residentReportsSearchSchema,
  search: {
    middlewares: [stripSearchParams(residentReportsSearchSchema.parse({}))],
  },
  component: Outlet,
})
