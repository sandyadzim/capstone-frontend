import axios from 'axios'
import { env } from '@/lib/env'

// Pass a TanStack Query query function's signal into each request config.
export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})
