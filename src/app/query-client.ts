import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/error'
import { expireSession, sessionGeneration } from '@/features/auth/session'

export function createQueryClient() {
  const queryGenerations = new WeakMap<object, number>()
  const mutationGenerations = new WeakMap<object, number>()
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Removed requests belong to an older account and must not expire a new session.
        if (
          query.meta?.requiresAuth &&
          error instanceof ApiError &&
          error.statusCode === 401 &&
          queryGenerations.get(query) === sessionGeneration(client) &&
          client
            .getQueryCache()
            .find({ queryKey: query.queryKey, exact: true }) === query
        )
          void expireSession(client)
      },
    }),
    mutationCache: new MutationCache({
      onMutate: (_variables, mutation) => {
        mutationGenerations.set(mutation, sessionGeneration(client))
      },
      onError: (error, _variables, _context, mutation) => {
        if (
          mutation.meta?.requiresAuth &&
          error instanceof ApiError &&
          error.statusCode === 401 &&
          mutationGenerations.get(mutation) === sessionGeneration(client)
        )
          void expireSession(client)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (count, error) =>
          count < 1 &&
          !(
            error instanceof ApiError &&
            (error.statusCode === 401 || error.statusCode === 403)
          ),
      },
      mutations: { retry: false },
    },
  })
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'fetch') {
      queryGenerations.set(event.query, sessionGeneration(client))
    }
  })
  return client
}

export const queryClient = createQueryClient()
