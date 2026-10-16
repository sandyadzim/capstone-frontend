import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from '@tanstack/react-router'
import { technicianTasksSearchSchema } from '@/features/technician/technician-tasks-search'

export const Route = createFileRoute('/technician/tasks')({
  validateSearch: technicianTasksSearchSchema,
  search: {
    middlewares: [stripSearchParams(technicianTasksSearchSchema.parse({}))],
  },
  component: Outlet,
})
