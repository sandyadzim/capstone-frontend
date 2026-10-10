import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from '@tanstack/react-router'
import { unitsSearchSchema } from '@/features/admin/units/unit-schema'

export const Route = createFileRoute('/admin/units')({
  validateSearch: unitsSearchSchema,
  search: { middlewares: [stripSearchParams(unitsSearchSchema.parse({}))] },
  head: () => ({ meta: [{ title: 'Units · Admin · Property' }] }),
  component: Outlet,
})
