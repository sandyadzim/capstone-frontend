import { z } from 'zod'
import { ApiError } from '@/lib/api/error'
import type { Unit, UnitCreate, UnitPatch } from './unit-schema'

export function changedUnitFields(unit: Unit, values: UnitCreate): UnitPatch {
  const patch: UnitPatch = {}
  if (unit.unitNumber !== values.unitNumber)
    patch.unitNumber = values.unitNumber
  if (unit.floor !== values.floor) patch.floor = values.floor
  if (unit.maintenanceFlag !== values.maintenanceFlag)
    patch.maintenanceFlag = values.maintenanceFlag
  return patch
}

const issuesSchema = z.object({
  issues: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    }),
  ),
})

export function unitFieldErrors(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR')
    return []
  const details = issuesSchema.safeParse(error.details)
  if (!details.success) return []
  return details.data.issues.filter(
    (issue) =>
      issue.path.length === 1 &&
      ['unitNumber', 'floor', 'maintenanceFlag', 'residentUserId'].includes(
        String(issue.path[0]),
      ),
  )
}
