import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { healthSchema } from '@/features/health/schema'

export async function getHealth(signal?: AbortSignal) {
  const response = await apiClient.get<unknown>('/health', { signal })
  const parsed = healthSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new ApiError(
      'The API returned an unexpected health response. Try again.',
      'INVALID_RESPONSE',
      response.status,
      undefined,
      parsed.error,
    )
  }
  return parsed.data
}

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: ({ signal }) => getHealth(signal),
  enabled: false,
  retry: false,
})
