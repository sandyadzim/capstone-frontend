import { afterEach, expect, it, vi } from 'vitest'
import { CanceledError, type AxiosAdapter } from 'axios'
import { apiClient } from '@/lib/api/client'
import {
  archiveUnit,
  createUnit,
  getUnit,
  getHistoryDetail,
  listHistory,
  listResidents,
  listUnits,
  placeResident,
  releaseResident,
  updateUnit,
} from '@/features/admin/units/unit-api'
import {
  unit,
  resident,
  historyItem,
  historyDetail,
  pageData,
} from './fixtures'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
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
it('forwards exact Unit list params, cookie credentials, and cancellation', async () => {
  const adapter = respond(pageData([unit]))
  const params = {
    page: 2,
    pageSize: 20,
    isArchived: 'true' as const,
    q: 'A%',
    displayStatus: 'MAINTENANCE' as const,
  }
  const signal = new AbortController().signal
  await expect(listUnits(params, signal)).resolves.toEqual(pageData([unit]))
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: '/units',
    method: 'get',
    params,
    signal,
    withCredentials: true,
  })
})
it('uses validated generated calls for each write, with only writable fields', async () => {
  const adapter = respond(unit)
  const signal = new AbortController().signal
  await createUnit(
    { unitNumber: ' A-101 ', floor: -1, maintenanceFlag: false },
    signal,
  )
  await updateUnit(unit.id, { floor: 0 }, signal)
  await placeResident(unit.id, resident.id, signal)
  await releaseResident(unit.id, signal)
  await archiveUnit(unit.id, signal)
  expect(
    adapter.mock.calls.map(([config]) => [config.method, config.url]),
  ).toEqual([
    ['post', '/units'],
    ['patch', `/units/${unit.id}`],
    ['put', `/units/${unit.id}/resident`],
    ['delete', `/units/${unit.id}/resident`],
    ['post', `/units/${unit.id}/archive`],
  ])
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    unitNumber: 'A-101',
    floor: -1,
    maintenanceFlag: false,
  })
  expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({ floor: 0 })
  expect(JSON.parse(adapter.mock.calls[2][0].data)).toEqual({
    residentUserId: resident.id,
  })
  for (const [config] of adapter.mock.calls) expect(config.signal).toBe(signal)
})
it('filters resident options on the server and validates placement identity', async () => {
  const adapter = respond(pageData([resident]))
  await expect(listResidents({ page: 2, pageSize: 10 })).resolves.toEqual(
    pageData([resident]),
  )
  expect(adapter.mock.calls[0][0].params).toEqual({
    page: 2,
    pageSize: 10,
    role: 'RESIDENT',
    isActive: 'true',
  })
  respond(pageData([{ ...resident, role: 'ADMIN' }]))
  await expect(listResidents({ page: 1, pageSize: 20 })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
it('validates history including nullable results and decimal costs', async () => {
  const adapter = respond(
    pageData([{ ...historyItem, maintenanceResult: null }]),
  )
  await expect(
    listHistory(unit.id, { page: 1, pageSize: 20 }),
  ).resolves.toMatchObject({
    data: [{ technician: null, maintenanceResult: null }],
  })
  expect(adapter.mock.calls[0][0].url).toBe(`/units/${unit.id}/history`)
  respond(pageData([{ ...historyItem, totalCost: 125000.5 }]))
  await expect(
    listHistory(unit.id, { page: 1, pageSize: 20 }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it.each([
  null,
  {},
  { ...unit, id: 'bad' },
  { ...unit, displayStatus: 'UNKNOWN' },
  { ...unit, activeResident: {} },
])('rejects malformed Unit reads and mutation responses: %j', async (body) => {
  respond(body)
  await expect(getUnit(unit.id)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
  await expect(updateUnit(unit.id, { floor: 2 })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
it('rejects invalid IDs, empty patches and unknown fields before a request', async () => {
  const adapter = respond(unit)
  await expect(getUnit('bad')).rejects.toThrow()
  await expect(updateUnit(unit.id, {})).rejects.toThrow()
  await expect(createUnit({ ...unit })).rejects.toThrow()
  await expect(placeResident(unit.id, 'bad')).rejects.toThrow()
  expect(adapter).not.toHaveBeenCalled()
})
it('preserves cancellation without sending aborted requests', async () => {
  const adapter = respond(unit)
  const controller = new AbortController()
  controller.abort()
  await expect(getUnit(unit.id, controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  await expect(archiveUnit(unit.id, controller.signal)).rejects.toBeInstanceOf(
    CanceledError,
  )
  expect(adapter).not.toHaveBeenCalled()
})

it('loads a closed report through the existing report detail API with cancellation and cookie credentials', async () => {
  const adapter = respond(historyDetail)
  const signal = new AbortController().signal
  await expect(
    getHistoryDetail(unit.id, historyDetail.id, signal),
  ).resolves.toEqual(historyDetail)
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: `/reports/${historyDetail.id}`,
    method: 'get',
    signal,
    withCredentials: true,
  })
})
it.each([
  { unit: { ...historyDetail.unit, id: resident.activeUnit!.id } },
  { id: unit.id },
  { status: 'COMPLETED' },
  { closedAt: null },
])(
  'rejects reports outside the requested closed Unit history: %j',
  async (patch) => {
    respond({ ...historyDetail, ...patch })
    await expect(
      getHistoryDetail(unit.id, historyDetail.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 })
  },
)
it.each([
  { totalCost: 125000.5 },
  {
    repairPhotos: [
      {
        id: unit.id,
        fileUrl: 'javascript:alert(1)',
        createdAt: unit.createdAt,
      },
    ],
  },
  { assignment: { ...historyDetail.assignment, assignedAt: 'invalid' } },
])(
  'rejects invalid history detail money, attachment URLs and timestamps: %j',
  async (patch) => {
    respond({ ...historyDetail, ...patch })
    await expect(
      getHistoryDetail(unit.id, historyDetail.id),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  },
)
it('validates history detail IDs before requesting and preserves cancellations', async () => {
  const adapter = respond(historyDetail)
  await expect(getHistoryDetail('bad', historyDetail.id)).rejects.toThrow()
  await expect(getHistoryDetail(unit.id, 'bad')).rejects.toThrow()
  const controller = new AbortController()
  controller.abort()
  await expect(
    getHistoryDetail(unit.id, historyDetail.id, controller.signal),
  ).rejects.toBeInstanceOf(CanceledError)
  expect(adapter).not.toHaveBeenCalled()
})
