// @vitest-environment jsdom
import type { AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import {
  createReport,
  uploadDamagePhoto,
} from '@/features/admin/reports/report-api'
import {
  reportCreateSchema,
  reportFormSchema,
} from '@/features/admin/reports/report-schema'
import {
  damagePhotoError,
  reportFieldErrors,
} from '@/features/admin/reports/report-utils'
import { createdReport, photo, reportCreate } from './fixtures'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
function respond(data: unknown, status = 201) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}
it('trims fields and requires contract fields without invented description limits', () => {
  expect(
    reportCreateSchema.parse({
      ...reportCreate,
      title: '  AC issue  ',
      description: '  Details  ',
    }),
  ).toMatchObject({ title: 'AC issue', description: 'Details' })
  expect(
    reportCreateSchema.safeParse({
      ...reportCreate,
      title: 'a'.repeat(160),
      description: 'a'.repeat(10001),
    }).success,
  ).toBe(true)
  for (const patch of [
    { title: ' ' },
    { title: 'a'.repeat(161) },
    { description: ' ' },
    { unitId: 'bad' },
    { category: 'INVALID' },
    { priority: 'URGENT' },
    { status: 'VERIFIED' },
  ])
    expect(
      reportCreateSchema.safeParse({ ...reportCreate, ...patch }).success,
    ).toBe(false)
  expect(
    reportFormSchema.safeParse({
      ...reportCreate,
      category: undefined,
      priority: undefined,
    }).success,
  ).toBe(false)
})
it('posts only normalized fields and validates the returned report', async () => {
  const adapter = respond({ ...createdReport, costItems: [] })
  const signal = new AbortController().signal
  expect(await createReport(reportCreate, signal)).toEqual(createdReport)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: '/reports',
    method: 'post',
    signal,
    withCredentials: true,
  })
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual(reportCreate)
})
it.each([
  { ...createdReport, id: 'bad' },
  { ...createdReport, damagePhotos: [{ ...photo, fileUrl: 'javascript:bad' }] },
  { ...createdReport, damagePhotos: undefined },
])('rejects an invalid saved report %j', async (value) => {
  respond(value)
  await expect(createReport(reportCreate)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
it('uploads one multipart file with a longer request timeout', async () => {
  const file = new File(['image'], 'damage.png', { type: 'image/png' })
  const adapter = respond(photo)
  const signal = new AbortController().signal
  expect(await uploadDamagePhoto(createdReport.id, file, signal)).toEqual(photo)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: `/reports/${createdReport.id}/damage-photos`,
    method: 'post',
    timeout: 120000,
    signal,
    withCredentials: true,
  })
  expect([...adapter.mock.calls[0][0].data.keys()]).toEqual(['file'])
  expect(adapter.mock.calls[0][0].data.get('file')).toBe(file)
})
it('validates image type, emptiness, and exact size boundaries before requests', async () => {
  expect(
    damagePhotoError(new File(['x'], 'image.jpg', { type: 'image/jpeg' })),
  ).toBeUndefined()
  expect(
    damagePhotoError(new File(['x'], 'image.webp', { type: 'image/webp' })),
  ).toBeUndefined()
  expect(
    damagePhotoError(
      new File([new Uint8Array(5 * 1024 * 1024)], 'image.png', {
        type: 'image/png',
      }),
    ),
  ).toBeUndefined()
  for (const file of [
    new File([], 'empty.png', { type: 'image/png' }),
    new File(['x'], 'file.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    }),
  ]) {
    const adapter = respond(photo)
    await expect(uploadDamagePhoto(createdReport.id, file)).rejects.toThrow()
    expect(adapter).not.toHaveBeenCalled()
  }
})
it('maps only validated create-field errors', () => {
  expect(
    reportFieldErrors(
      new ApiError('Invalid', 'VALIDATION_ERROR', 400, {
        issues: [
          { path: ['title'], message: 'Required' },
          { path: ['status'], message: 'Unknown' },
          null,
        ],
      }),
    ),
  ).toEqual([{ path: ['title'], message: 'Required' }])
  expect(reportFieldErrors(new Error('Oops'))).toEqual([])
})
