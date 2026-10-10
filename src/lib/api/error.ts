import axios from 'axios'
import { z } from 'zod'

const apiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
})

export class ApiError extends Error {
  readonly statusCode: number | undefined
  readonly code: string
  readonly details: unknown

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: unknown,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export function normalizeApiError(error: unknown): Error {
  // Query needs the original cancellation error to distinguish an aborted request.
  if (axios.isCancel(error)) return error
  if (!axios.isAxiosError(error)) {
    return error instanceof Error
      ? error
      : new Error('An unexpected error occurred.')
  }

  if (error.response) {
    const parsed = apiErrorSchema.safeParse(error.response.data)
    if (parsed.success) {
      return new ApiError(
        parsed.data.message,
        parsed.data.code,
        error.response.status,
        parsed.data.details,
        error,
      )
    }
    return new ApiError(
      `The server returned HTTP ${error.response.status}. Try again.`,
      'HTTP_ERROR',
      error.response.status,
      undefined,
      error,
    )
  }

  const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
  return new ApiError(
    isTimeout
      ? 'The request timed out. Try again.'
      : 'Cannot reach the API. Check your connection and try again.',
    isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
    undefined,
    undefined,
    error,
  )
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Something went wrong. Try again.'
}
