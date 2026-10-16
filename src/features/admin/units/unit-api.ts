import { z } from 'zod'
import {
  accountsControllerList,
  dashboardHistoryControllerListHistory,
  unitsControllerList,
  unitsControllerGet,
  unitsControllerCreate,
  unitsControllerUpdate,
  unitsControllerPlace,
  unitsControllerRelease,
  unitsControllerArchive,
  reportsControllerGet,
} from '@/lib/api/generated/endpoints'
import { ApiError } from '@/lib/api/error'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  unitSchema,
  unitListSchema,
  unitCreateSchema,
  unitPatchSchema,
  residentPlacementSchema,
  residentListSchema,
  historyListSchema,
  historyDetailSchema,
  type UnitCreate,
  type UnitPatch,
} from './unit-schema'

export async function getHistoryDetail(
  unitId: string,
  reportId: string,
  signal?: AbortSignal,
) {
  z.uuid().parse(unitId)
  const report = parseApiResponse(
    historyDetailSchema,
    await reportsControllerGet(z.uuid().parse(reportId), { signal }),
  )
  if (
    report.id.toLowerCase() !== reportId.toLowerCase() ||
    report.unit.id.toLowerCase() !== unitId.toLowerCase() ||
    report.status !== 'CLOSED' ||
    !report.closedAt
  )
    throw new ApiError(
      'This report is not in this unit’s closed maintenance history.',
      'NOT_FOUND',
      404,
    )
  return { ...report, status: 'CLOSED' as const, closedAt: report.closedAt }
}

export async function listUnits(
  params: {
    page: number
    pageSize: number
    isArchived: 'true' | 'false'
    displayStatus?: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'
    q?: string
  },
  signal?: AbortSignal,
) {
  return parseApiResponse(
    unitListSchema,
    await unitsControllerList(params, { signal }),
  )
}

export async function getUnit(id: string, signal?: AbortSignal) {
  return parseApiResponse(
    unitSchema,
    await unitsControllerGet(z.uuid().parse(id), { signal }),
  )
}

export async function createUnit(values: UnitCreate, signal?: AbortSignal) {
  return parseApiResponse(
    unitSchema,
    await unitsControllerCreate(unitCreateSchema.parse(values), { signal }),
  )
}

export async function updateUnit(
  id: string,
  values: UnitPatch,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    unitSchema,
    await unitsControllerUpdate(
      z.uuid().parse(id),
      unitPatchSchema.parse(values),
      { signal },
    ),
  )
}
export async function placeResident(
  id: string,
  residentUserId: string,
  signal?: AbortSignal,
) {
  return parseApiResponse(
    unitSchema,
    await unitsControllerPlace(
      z.uuid().parse(id),
      {
        ...residentPlacementSchema.parse({ residentUserId }),
        unassignedOnly: true,
      },
      { signal },
    ),
  )
}

export async function releaseResident(id: string, signal?: AbortSignal) {
  return parseApiResponse(
    unitSchema,
    await unitsControllerRelease(z.uuid().parse(id), { signal }),
  )
}

export async function archiveUnit(id: string, signal?: AbortSignal) {
  return parseApiResponse(
    unitSchema,
    await unitsControllerArchive(z.uuid().parse(id), { signal }),
  )
}

export async function listResidents(
  params: { page: number; pageSize: number; q?: string },
  signal?: AbortSignal,
) {
  return parseApiResponse(
    residentListSchema,
    await accountsControllerList(
      { ...params, role: 'RESIDENT', isActive: 'true', unassignedOnly: 'true' },
      { signal },
    ),
  )
}

export async function listHistory(
  id: string,
  params: { page: number; pageSize: number },
  signal?: AbortSignal,
) {
  return parseApiResponse(
    historyListSchema,
    await dashboardHistoryControllerListHistory(z.uuid().parse(id), params, {
      signal,
    }),
  )
}
