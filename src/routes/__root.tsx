import { createRootRouteWithContext } from '@tanstack/react-router'
import { Root } from '@/app/root'
import type { QueryClient } from '@tanstack/react-query'
import {
  RouteError,
  RouteNotFound,
  RoutePending,
} from '@/components/route-states'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({ meta: [{ title: 'Property' }] }),
    component: Root,
    pendingComponent: RoutePending,
    errorComponent: RouteError,
    notFoundComponent: RouteNotFound,
  },
)
