import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { apiClient } from '@/lib/api/client'

// OpenAPI paths include /api; apiClient's configurable base URL already owns it.
// Keep the complete response so features can validate data and report HTTP status.
export function apiRequest<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.request<T>({
    ...config,
    ...options,
    url: config.url?.replace(/^\/api(?=\/|$)/, '') || '/',
  })
}
