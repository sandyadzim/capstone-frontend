import { queryOptions } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import type { z } from 'zod'
import { healthControllerGetHealth } from '@/lib/api/generated/endpoints'
import type { HealthResponseDto } from '@/lib/api/generated/endpoints.schemas'
import { ApiError } from '@/lib/api/error'
import { healthSchema } from '@/features/health/schema'

export async function getHealth(
  signal?: AbortSignal,
): Promise<z.output<typeof healthSchema>> {
  const response: AxiosResponse<HealthResponseDto> =
    await healthControllerGetHealth({ signal })
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
