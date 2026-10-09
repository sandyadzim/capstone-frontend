import type { AxiosInstance } from 'axios'
import { normalizeApiError } from '@/lib/api/error'

export function setupApiInterceptors(client: AxiosInstance) {
  client.interceptors.request.use((config) => {
    config.headers.set('Accept', 'application/json')
    // Axios sets Content-Type for JSON or multipart bodies; session cookies are
    // browser-managed, so no Authorization or Cookie header is added here.
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(normalizeApiError(error)),
  )
}
