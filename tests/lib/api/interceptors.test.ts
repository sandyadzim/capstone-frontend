import { expect, it } from 'vitest'
import axios, { AxiosError } from 'axios'
import { setupApiInterceptors } from '@/lib/api/interceptors'

it('request interceptor sets JSON Accept without overriding multipart Content-Type', async () => {
  const client = axios.create({
    adapter: async (config) => {
      expect(config.headers.get('Accept')).toBe('application/json')
      expect(config.headers.get('Content-Type')).toBe('multipart/form-data')
      expect(config.headers.has('Authorization')).toBe(false)
      expect(config.headers.has('Cookie')).toBe(false)
      return {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    },
  })
  setupApiInterceptors(client)
  const response = await client.post('/upload', new FormData(), {
    headers: { Accept: 'text/html', 'Content-Type': 'multipart/form-data' },
  })
  expect(response.data).toEqual({ status: 'ok' })
  expect(response.status).toBe(200)
})

it('response interceptor rejects transport failures as normalized API errors', async () => {
  const original = new AxiosError('Network failed', 'ERR_NETWORK')
  const client = axios.create({
    adapter: async () => {
      throw original
    },
  })
  setupApiInterceptors(client)
  await expect(client.get('/example')).rejects.toMatchObject({
    name: 'ApiError',
    code: 'NETWORK_ERROR',
    message: 'Cannot reach the API. Check your connection and try again.',
    cause: original,
  })
})
