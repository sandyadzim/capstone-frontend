import { defineTransformer } from 'orval'

export default defineTransformer((document) => {
  // Nest Swagger infers bare nullable strings as Object without an explicit type.
  // These wire types are confirmed by cp-be's report.dto.ts and feature guide.
  const fields = [
    ['ReportAssignmentResponseDto', 'note'],
    ['ReportDetailResponseDto', 'rejectionReason'],
  ] as const

  for (const [schemaName, fieldName] of fields) {
    const schema = document.components?.schemas?.[schemaName]
    if (!schema || typeof schema !== 'object' || !('properties' in schema))
      continue
    const properties = schema.properties
    if (!properties) continue
    const field = properties[fieldName]
    // Only fix the known ambiguous shape; preserve a corrected upstream schema.
    if (
      field &&
      typeof field === 'object' &&
      'type' in field &&
      field.type === 'object' &&
      'nullable' in field &&
      field.nullable === true &&
      Object.keys(field).every((key) => key === 'type' || key === 'nullable')
    ) {
      properties[fieldName] = { ...field, type: 'string' }
    }
  }
  return document
})
