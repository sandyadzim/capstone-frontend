import { afterEach, expect, it, vi } from 'vitest'
import { CanceledError, type AxiosAdapter } from 'axios'
import { apiClient } from '@/lib/api/client'
import { getResidentUnit } from '@/features/resident/resident-api'

const originalAdapter = apiClient.defaults.adapter
const unit = {
  id: '11000000-0000-4000-8000-000000000002',
  unitNumber: 'A-204',
  floor: 2,
}
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function respond(data: unknown) {
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

it('reads the current unit with cookies and cancellation, without a caller-supplied ID', async () => {
  const adapter = respond({
    unit: { ...unit, activeResident: 'private' },
    extra: true,
  })
  const signal = new AbortController().signal
  await expect(getResidentUnit(signal)).resolves.toEqual({ unit })
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: '/resident/unit',
    method: 'get',
    withCredentials: true,
    signal,
  })
  expect(adapter.mock.calls[0][0].params).toBeUndefined()
})

it('accepts unassigned residents and floors including zero and negative values', async () => {
  respond({ unit: null })
  await expect(getResidentUnit()).resolves.toEqual({ unit: null })
  for (const floor of [-32768, -1, 0, 32767]) {
    respond({ unit: { ...unit, floor } })
    await expect(getResidentUnit()).resolves.toEqual({
      unit: { ...unit, floor },
    })
  }
})

it.each([
  undefined,
  {},
  { unit: {} },
  { unit: { ...unit, id: 'bad' } },
  { unit: { ...unit, unitNumber: '' } },
  { unit: { ...unit, unitNumber: 'A'.repeat(41) } },
  { unit: { ...unit, floor: 1.5 } },
  { unit: { ...unit, floor: 32768 } },
])(
  'rejects an invalid response instead of treating it as unassigned: %j',
  async (data) => {
    respond(data)
    await expect(getResidentUnit()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  },
)

it('preserves cancellation rather than showing a request failure', async () => {
  const controller = new AbortController()
  controller.abort()
  const adapter = respond({ unit })
  await expect(getResidentUnit(controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  expect(adapter).not.toHaveBeenCalled()
})
