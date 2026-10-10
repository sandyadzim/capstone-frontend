import { afterEach, expect, it, vi } from 'vitest'
import { CanceledError, type AxiosAdapter } from 'axios'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import {
  getProperty,
  updateProperty,
  uploadPropertyLogo,
} from '@/features/admin/settings/settings-api'
import { logoFileError } from '@/features/admin/settings/settings-utils'
import { propertyPatchSchema } from '@/features/admin/settings/settings-schema'
import { property } from './fixtures'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
function respond(data: unknown = property) {
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
it('validates properties, strips unknown fields, and forwards cookies and the read cancellation signal', async () => {
  const adapter = respond({ ...property, extra: true })
  const signal = new AbortController().signal
  await expect(getProperty(signal)).resolves.toEqual(property)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: '/property',
    method: 'get',
    signal,
    withCredentials: true,
  })
})
it.each([
  null,
  {},
  { ...property, id: 'bad' },
  { ...property, name: '' },
  { ...property, name: 'a'.repeat(161) },
  { ...property, address: '' },
  { ...property, logoUrl: 'javascript:alert(1)' },
  { ...property, createdAt: 'bad' },
  { ...property, updatedAt: null },
])(
  'rejects malformed responses for every property operation: %j',
  async (data) => {
    respond(data)
    await expect(getProperty()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    await expect(updateProperty({ name: 'Updated' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    await expect(
      uploadPropertyLogo(
        new File(['image'], 'logo.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  },
)
it('sends trimmed partial patches and a null logo removal, never a property ID or logo URL', async () => {
  const adapter = respond()
  const signal = new AbortController().signal
  await updateProperty({ name: ' Updated ' }, signal)
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ name: 'Updated' })
  expect(adapter.mock.calls[0][0].signal).toBe(signal)
  await updateProperty({ logoUrl: null })
  expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({ logoUrl: null })
  for (const data of [
    {},
    { name: ' ' },
    { address: '' },
    { name: 'a'.repeat(161) },
    { name: 'Name', id: property.id },
    { logoUrl: 'https://example.com/logo.png' },
  ])
    expect(propertyPatchSchema.safeParse(data).success).toBe(false)
  await expect(updateProperty({})).rejects.toThrow()
  expect(adapter).toHaveBeenCalledTimes(2)
})
it('uploads one multipart file using shared credentials and signal', async () => {
  const adapter = respond()
  const file = new File(['image'], 'logo.png', { type: 'image/png' })
  const signal = new AbortController().signal
  await uploadPropertyLogo(file, signal)
  const config = adapter.mock.calls[0][0]
  expect(config).toMatchObject({
    url: '/property/logo',
    method: 'put',
    signal,
    withCredentials: true,
  })
  expect(config.data).toBeInstanceOf(FormData)
  expect([...config.data.keys()]).toEqual(['file'])
  expect(config.data.get('file')).toBe(file)
})
it('validates file type, nonempty size, and exact 5 MiB boundary before upload', async () => {
  const adapter = respond()
  for (const type of ['image/jpeg', 'image/png', 'image/webp'])
    expect(logoFileError({ type, size: 5 * 1024 * 1024 })).toBeUndefined()
  expect(
    logoFileError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }),
  ).toContain('5 MiB')
  expect(logoFileError({ type: 'image/png', size: 0 })).toContain('nonempty')
  expect(logoFileError({ type: 'image/svg+xml', size: 1 })).toContain('JPEG')
  await expect(
    uploadPropertyLogo(new File([], 'empty.png', { type: 'image/png' })),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  expect(adapter).not.toHaveBeenCalled()
})
it('preserves transport errors and cancels already-aborted property requests', async () => {
  const error = new ApiError('Missing property', 'NOT_FOUND', 404)
  apiClient.defaults.adapter = async () => {
    throw error
  }
  await expect(getProperty()).rejects.toBe(error)
  await expect(updateProperty({ name: 'Updated' })).rejects.toBe(error)
  const adapter = respond()
  const controller = new AbortController()
  controller.abort()
  await expect(getProperty(controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  await expect(
    updateProperty({ logoUrl: null }, controller.signal),
  ).rejects.toBeInstanceOf(CanceledError)
  await expect(
    uploadPropertyLogo(
      new File(['image'], 'image.png', { type: 'image/png' }),
      controller.signal,
    ),
  ).rejects.toBeInstanceOf(CanceledError)
  expect(adapter).not.toHaveBeenCalled()
})
