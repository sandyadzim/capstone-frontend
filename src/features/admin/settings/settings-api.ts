import {
  attachmentsControllerUploadLogo,
  propertyControllerGet,
  propertyControllerUpdate,
} from '@/lib/api/generated/endpoints'
import { ApiError } from '@/lib/api/error'
import { parseApiResponse } from '@/lib/api/parse-response'
import {
  propertyPatchSchema,
  propertySchema,
  type Property,
  type PropertyPatch,
} from './settings-schema'
import { logoFileError } from './settings-utils'

export async function getProperty(signal?: AbortSignal): Promise<Property> {
  return parseApiResponse(
    propertySchema,
    await propertyControllerGet({ signal }),
  )
}

export async function updateProperty(
  patch: PropertyPatch,
  signal?: AbortSignal,
): Promise<Property> {
  return parseApiResponse(
    propertySchema,
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
  return parseApiResponse(
    propertySchema,
    await attachmentsControllerUploadLogo({ file }, { signal }),
  )
}
