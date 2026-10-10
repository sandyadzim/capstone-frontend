import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, getErrorMessage, normalizeApiError } from '@/lib/api/error'

function httpError(data: unknown, status = 500) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(
    'Request failed',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    {
      data,
      status,
      statusText: 'Error',
      headers: {},
      config,
    },
  )
}

describe('API error normalization', () => {
  it('preserves backend details and cause, using the actual HTTP status', () => {
    const details = { issues: [{ path: ['title'], message: 'Required' }] }
    const original = httpError(
      {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details,
      },
      422,
    )
    const error = normalizeApiError(original)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      name: 'ApiError',
      message: 'Invalid request',
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      details,
      cause: original,
    })
  })

  it('accepts an error envelope without optional details', () => {
    expect(
      normalizeApiError(
        httpError(
          { statusCode: 503, code: 'UNAVAILABLE', message: 'Try later' },
          503,
        ),
      ),
    ).toMatchObject({ code: 'UNAVAILABLE', details: undefined })
  })

  it.each([
    null,
    '<html>private error</html>',
    {},
    { statusCode: 200, code: 'ERROR', message: 'private error' },
    { statusCode: 600, code: 'ERROR', message: 'private error' },
    { statusCode: 500.5, code: 'ERROR', message: 'private error' },
    { statusCode: 500, code: '', message: 'private error' },
    { statusCode: 500, code: 'ERROR', message: '' },
  ])('uses a safe HTTP fallback for an invalid envelope %j', (data) => {
    const original = httpError(data, 502)
    expect(normalizeApiError(original)).toMatchObject({
      message: 'The server returned HTTP 502. Try again.',
      code: 'HTTP_ERROR',
      statusCode: 502,
      details: undefined,
      cause: original,
    })
  })

  it.each([
    [
      'ERR_NETWORK',
      'NETWORK_ERROR',
      'Cannot reach the API. Check your connection and try again.',
    ],
    ['ECONNABORTED', 'TIMEOUT', 'The request timed out. Try again.'],
    ['ETIMEDOUT', 'TIMEOUT', 'The request timed out. Try again.'],
  ])('normalizes transport failure %s', (transportCode, code, message) => {
    const original = new AxiosError('Internal transport message', transportCode)
    expect(normalizeApiError(original)).toMatchObject({
      code,
      message,
      statusCode: undefined,
      cause: original,
    })
  })

  it('keeps cancellation and ordinary errors intact', () => {
    const cancellation = new CanceledError()
    const ordinary = new Error('Something failed')
    expect(normalizeApiError(cancellation)).toBe(cancellation)
    expect(normalizeApiError(ordinary)).toBe(ordinary)
  })

  it.each([
    undefined,
    null,
    'private thrown value',
    { message: 'private error' },
  ])('safely handles a non-Error rejection %j', (value) => {
    expect(normalizeApiError(value)).toEqual(
      new Error('An unexpected error occurred.'),
    )
  })
})

describe('error display messages', () => {
  it.each([400, 401, 403, 404, 409, 500, 503])(
    'preserves the backend message for HTTP %s',
    (status) => {
      const error = normalizeApiError(
        httpError(
          {
            statusCode: status,
            code: 'REQUEST_ERROR',
            message: 'Backend explanation',
          },
          status,
        ),
      )
      expect(getErrorMessage(error)).toBe('Backend explanation')
    },
  )
  it('preserves local errors and supplies a fallback when no message exists', () => {
    expect(getErrorMessage(new Error('Cannot reach the API.'))).toBe(
      'Cannot reach the API.',
    )
    for (const error of [undefined, null, {}, new Error(''), new Error('  ')]) {
      expect(getErrorMessage(error)).toBe('Something went wrong. Try again.')
    }
  })
})
