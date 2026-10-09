import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', undefined)
})

it('defaults to the same-origin API path when no URL is configured', async () => {
  const { env } = await import('@/lib/env')
  expect(env.VITE_API_BASE_URL).toBe('/api')
})

it.each([
  '/api',
  '/api/v1',
  '/',
  'http://localhost:3001/api',
  'https://api.example.com',
])('accepts the public API address %s', async (value) => {
  vi.stubEnv('VITE_API_BASE_URL', value)
  const { env } = await import('@/lib/env')
  expect(env.VITE_API_BASE_URL).toBe(value)
})

it('trims the configured URL', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '  /api  ')
  const { env } = await import('@/lib/env')
  expect(env.VITE_API_BASE_URL).toBe('/api')
})

it('applies the configured base URL to the shared Axios client', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api')
  const { apiClient } = await import('@/lib/api/client')
  expect(apiClient.defaults.baseURL).toBe('https://api.example.com/api')
})

it.each([
  '',
  '   ',
  '//api.example.com',
  'api/v1',
  'localhost:3001',
  'ftp://api.example.com',
  'javascript:alert(1)',
])('rejects invalid API configuration %j at startup', async (value) => {
  vi.stubEnv('VITE_API_BASE_URL', value)
  await expect(import('@/lib/env')).rejects.toThrow('VITE_API_BASE_URL')
})
