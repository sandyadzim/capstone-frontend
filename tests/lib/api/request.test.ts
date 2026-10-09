import type { AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { apiRequest } from '@/lib/api/request'
import {
  attachmentsControllerUploadReceipt,
  authControllerLogin,
  reportsControllerList,
} from '@/lib/api/generated/endpoints'

const originalAdapter = apiClient.defaults.adapter
const originalBaseURL = apiClient.defaults.baseURL

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  apiClient.defaults.baseURL = originalBaseURL
})

function captureRequest() {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data: { result: 'example' },
    status: 200,
    statusText: 'OK',
    headers: { 'x-request-id': 'example' },
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}

it.each(['/api', 'http://localhost:3001/api', '/gateway'])(
  'resolves generated paths against %s without duplicating the API prefix',
  async (baseURL) => {
    apiClient.defaults.baseURL = baseURL
    const adapter = captureRequest()
    const controller = new AbortController()
    await reportsControllerList(
      { page: 2, q: 'AC & fan', status: 'REPORTED' },
      { signal: controller.signal, timeout: 5_000 },
    )
    const [config] = adapter.mock.calls[0]
    expect(config).toMatchObject({
      url: '/reports',
      signal: controller.signal,
      timeout: 5_000,
      withCredentials: true,
    })
    expect(apiClient.getUri(config)).toBe(
      `${baseURL}/reports?page=2&q=AC+%26+fan&status=REPORTED`,
    )
  },
)

it('keeps HTTP metadata and serializes generated JSON bodies through shared Axios', async () => {
  const adapter = captureRequest()
  const body = { loginIdentifier: 'example@example.test', password: 'example' }
  const response = await authControllerLogin(body)
  const [config] = adapter.mock.calls[0]
  expect(config).toMatchObject({ url: '/auth/login', method: 'post' })
  expect(JSON.parse(config.data)).toEqual(body)
  expect(config.headers.get('Accept')).toBe('application/json')
  expect(config.headers.get('Content-Type')).toBe('application/json')
  expect(response).toMatchObject({
    data: { result: 'example' },
    status: 200,
    headers: { 'x-request-id': 'example' },
  })
})

it('passes generated multipart files through without JSON serialization', async () => {
  const adapter = captureRequest()
  const id = '11000000-0000-4000-8000-000000000001'
  const file = new File(['example receipt'], 'receipt.pdf', {
    type: 'application/pdf',
  })
  await attachmentsControllerUploadReceipt(id, { file })
  const [config] = adapter.mock.calls[0]
  expect(config).toMatchObject({ url: `/reports/${id}/receipt`, method: 'put' })
  expect(config.data).toBeInstanceOf(FormData)
  expect(config.data.get('file')).toBe(file)
})

it.each([
  ['/api', '/'],
  ['/api/api/reports', '/api/reports'],
  ['/apiary', '/apiary'],
])(
  'normalizes only the leading API path segment in %s',
  async (url, expected) => {
    const adapter = captureRequest()
    await apiRequest({ url, method: 'GET' })
    expect(adapter.mock.calls[0][0].url).toBe(expected)
  },
)
