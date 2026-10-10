import type { AxiosResponse } from 'axios'
import {
  attachmentsControllerUploadLogo,
  propertyControllerGet,
  propertyControllerUpdate,
} from '@/lib/api/generated/endpoints'
import { ApiError } from '@/lib/api/error'
import {
  propertyPatchSchema,
  propertySchema,
  type Property,
  type PropertyPatch,
} from './settings-schema'
import { logoFileError } from './settings-utils'

function parseProperty(response: AxiosResponse<unknown>): Property {
  const parsed = propertySchema.safeParse(response.data)
  if (!parsed.success)
    throw new ApiError(
      'The API returned an unexpected property response. Try again.',
      'INVALID_RESPONSE',
      response.status,
      undefined,
      parsed.error,
    )
  return parsed.data
}
export async function getProperty(signal?: AbortSignal): Promise<Property> {
  return parseProperty(await propertyControllerGet({ signal }))
}
export async function updateProperty(
  patch: PropertyPatch,
  signal?: AbortSignal,
): Promise<Property> {
  return parseProperty(
    await propertyControllerUpdate(propertyPatchSchema.parse(patch), {
      signal,
    }),
  )
}
export async function uploadPropertyLogo(
  file: File,
  signal?: AbortSignal,
): Promise<Property> {
  const error = logoFileError(file)
  if (error) throw new ApiError(error, 'VALIDATION_ERROR', 400)
  return parseProperty(
    await attachmentsControllerUploadLogo({ file }, { signal }),
  )
}
