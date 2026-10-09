import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .min(1, 'VITE_API_BASE_URL must not be empty.')
    .refine((value) => {
      if (value.startsWith('/') && !value.startsWith('//')) return true
      try {
        const url = new URL(value)
        return url.protocol === 'https:' || url.protocol === 'http:'
      } catch {
        return false
      }
    }, 'VITE_API_BASE_URL must be a root-relative path or an HTTP(S) URL.')
    .default('/api'),
})

export const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
})
