import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isCancelledError } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { formatIdr } from '@/lib/format'
import { createQueryClient } from '@/app/query-client'
import { clearRevokedSession, sessionKey } from '@/features/auth/auth-session'
import {
  getDashboardSummary,
  getDashboardTrends,
} from '@/features/admin/dashboard/dashboard-api'
import {
  dashboardSummaryQueryOptions,
  dashboardTrendsQueryOptions,
} from '@/features/admin/dashboard/dashboard-queries'
import { dashboardSearchSchema } from '@/features/admin/dashboard/dashboard-schema'
import { summary, makeTrends } from './fixtures'
import { admin } from '../settings/fixtures'

const original = apiClient.defaults.adapter
let body: unknown
beforeEach(() => {
  body = summary
  apiClient.defaults.adapter = async (config) => ({
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
it('reads the generated summary endpoint with cancellation and preserves exact decimal cost', async () => {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
    data: summary,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  const controller = new AbortController()
  expect(await getDashboardSummary(controller.signal)).toEqual(summary)
  expect(adapter).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/dashboard/summary',
      method: 'get',
      signal: controller.signal,
    }),
  )
  const large = '900719925474099312345678901234.50'
  body = { ...summary, totalClosedCost: large }
  apiClient.defaults.adapter = async (config) => ({
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  expect((await getDashboardSummary()).totalClosedCost).toBe(large)
  expect(formatIdr(large)).toBe('Rp 900.719.925.474.099.312.345.678.901.234,50')
})
it.each([
  { totalUnits: -1 },
  { totalReports: 1.5 },
  { activeReports: '24' },
  { inProgressReports: Number.MAX_SAFE_INTEGER + 1 },
  { closedReportsThisMonth: null },
  { totalClosedCost: 0 },
  { totalClosedCost: '10.5' },
  { totalClosedCost: '-1.00' },
])('rejects malformed summary fields: %j', async (patch) => {
  body = { ...summary, ...patch }
  await expect(getDashboardSummary()).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    statusCode: 200,
  })
})
it('accepts a genuinely empty property and defaults invalid queue URLs to review', async () => {
  body = {
    totalUnits: 0,
    totalReports: 0,
    activeReports: 0,
    inProgressReports: 0,
    closedReportsThisMonth: 0,
    totalClosedCost: '0.00',
  }
  expect(await getDashboardSummary()).toEqual(body)
  expect(dashboardSearchSchema.parse({}).queue).toBe('review')
  for (const queue of ['wrong', 2, null, ['review']])
    expect(dashboardSearchSchema.parse({ queue }).queue).toBe('review')
  expect(dashboardSearchSchema.parse({ queue: 'closure' }).queue).toBe(
    'closure',
  )
})
it('does not retry automatically and marks the summary as authenticated with sixty-second freshness', async () => {
  const calls = vi.fn(() => {
    throw new ApiError('Offline', 'NETWORK_ERROR')
  })
  apiClient.defaults.adapter = calls
  const client = createQueryClient()
  const options = dashboardSummaryQueryOptions()
  expect(options).toMatchObject({
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
  await expect(client.fetchQuery(options)).rejects.toThrow('Offline')
  expect(calls).toHaveBeenCalledTimes(1)
  client.clear()
})
it('aborts an in-flight summary and cannot restore it after session cleanup', async () => {
  let finish!: () => void
  let signal: AbortSignal | undefined
  const hold = new Promise<void>((resolve) => {
    finish = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    signal = config.signal as AbortSignal
    await hold
    return { data: summary, status: 200, statusText: 'OK', headers: {}, config }
  }
  const client = createQueryClient()
  client.setQueryData(sessionKey, admin)
  const options = dashboardSummaryQueryOptions()
  const pending = client.fetchQuery(options).catch((error: unknown) => error)
  await vi.waitFor(() => expect(signal).toBeDefined())
  await clearRevokedSession(client)
  expect(signal?.aborted).toBe(true)
  finish()
  expect(isCancelledError(await pending)).toBe(true)
  expect(client.getQueryData(options.queryKey)).toBeUndefined()
  client.clear()
})

it('validates dashboard sort URLs with a safe latest default', () => {
  expect(dashboardSearchSchema.parse({ sort: 'priority' }).sort).toBe(
    'priority',
  )
  for (const sort of [undefined, null, 4, 'oldest', ['priority']]) {
    expect(dashboardSearchSchema.parse({ sort }).sort).toBe('latest')
  }
})

it('reads six monthly aggregates through the generated client with cancellation and exact money', async () => {
  const trends = makeTrends(new Date('2026-09-30T17:00:00Z'))
  trends.months[0].closedCost = '900719925474099312345678901234.50'
  body = trends
  let request: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = async (config) => {
    request = config
    return { data: body, status: 200, statusText: 'OK', headers: {}, config }
  }
  const controller = new AbortController()
  expect(await getDashboardTrends(controller.signal)).toEqual(trends)
  expect(request).toMatchObject({
    url: '/dashboard/trends',
    params: { months: 6 },
    signal: controller.signal,
  })
  expect(dashboardTrendsQueryOptions()).toMatchObject({
    queryKey: ['admin', 'dashboard', 'trends', 6],
    meta: { requiresAuth: true },
    retry: false,
    staleTime: 60_000,
  })
})
it.each([
  'missing',
  'duplicate',
  'nonconsecutive',
  'wrong-zone',
  'bad-cost',
  'bad-count',
  'bad-time',
])('rejects malformed monthly aggregates: %s', async (kind) => {
  const trends = makeTrends()
  if (kind === 'missing') trends.months.pop()
  if (kind === 'duplicate') trends.months[1].month = trends.months[0].month
  if (kind === 'nonconsecutive') trends.months[0].month = '2000-01'
  if (kind === 'bad-cost') trends.months[0].closedCost = '0.5'
  if (kind === 'bad-count') trends.months[0].reportedCount = -1
  if (kind === 'bad-time') trends.generatedAt = 'invalid'
  body = kind === 'wrong-zone' ? { ...trends, timeZone: 'UTC' } : trends
  await expect(getDashboardTrends()).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
