import { residentUnitControllerGet } from '@/lib/api/generated/endpoints'
import { parseApiResponse } from '@/lib/api/parse-response'
import { residentUnitSchema } from './resident-schema'

export async function getResidentUnit(signal?: AbortSignal) {
  const response = await residentUnitControllerGet({ signal })
  return parseApiResponse(residentUnitSchema, response)
}
