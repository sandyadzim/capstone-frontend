import { createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { queryClient } from './query-client'
import { RoutePending } from '@/components/route-states'

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultPendingComponent: RoutePending,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
