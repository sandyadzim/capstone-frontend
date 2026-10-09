import { CanceledError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { getHealth } from '@/features/health/api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function respondWith(data: unknown) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}

it('uses the shared transport defaults and forwards cancellation to GET /health', async () => {
  const adapter = respondWith({
    status: 'ok',
    extra: 'not part of the contract',
  })
  const controller = new AbortController()
  await expect(getHealth(controller.signal)).resolves.toEqual({ status: 'ok' })
  expect(adapter).toHaveBeenCalledOnce()
  const [config] = adapter.mock.calls[0]
  expect(config).toMatchObject({
    url: '/health',
    method: 'get',
    timeout: 10_000,
    withCredentials: true,
    signal: controller.signal,
  })
  expect(config.headers.get('Accept')).toBe('application/json')
  expect(config.headers.has('Authorization')).toBe(false)
})

it.each([{ status: 'down' }, {}, null, '<html>SPA fallback</html>'])(
  'rejects a successful HTTP response with an invalid body %j',
  async (data) => {
    respondWith(data)
    await expect(getHealth()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_RESPONSE',
      statusCode: 200,
      cause: expect.any(Error),
    })
  },
)

it('propagates normalized errors without replacing their details', async () => {
  const error = new ApiError('Service unavailable', 'UNAVAILABLE', 503)
  apiClient.defaults.adapter = async () => {
    throw error
  }
  await expect(getHealth()).rejects.toBe(error)
})

it('preserves cancellation and avoids sending an already-aborted request', async () => {
  const adapter = respondWith({ status: 'ok' })
  const controller = new AbortController()
  controller.abort()
  await expect(getHealth(controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  expect(adapter).not.toHaveBeenCalled()
})
