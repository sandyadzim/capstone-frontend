// @vitest-environment jsdom
import type { AxiosRequestConfig } from 'axios'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { sessionKey } from '@/features/auth/auth-session'
import { reportDetailKey } from '@/features/admin/reports/report-queries'
import type { ReportDetail } from '@/features/admin/reports/report-schema'
import { admin, property } from '../settings/fixtures'
import { completedReport, reportPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let report: ReportDetail
let readError: ApiError | undefined
let readHold: Promise<void> | undefined
let requests: AxiosRequestConfig[]
let writeError: ApiError | undefined
let writeHold: Promise<void> | undefined
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  report = {
    ...structuredClone(completedReport),
    status: 'COMPLETED',
    closedAt: null,
    closedBy: null,
    damagePhotos: [],
    repairPhotos: [],
  }
  readError = undefined
  readHold = undefined
  requests = []
  writeError = undefined
  writeHold = undefined
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = admin
    else if (config.url === '/property') data = property
    else if (
      config.method === 'post' &&
      config.url === `/reports/${report.id}/close`
    ) {
      if (writeHold) await writeHold
      if (writeError) throw writeError
      report = {
        ...report,
        status: 'CLOSED',
        closedAt: '2026-10-11T09:00:00.000Z',
        closedBy: { id: admin.id, name: admin.name },
      }
      data = report
    } else if (config.url === `/reports/${completedReport.id}`) {
      if (readHold) await readHold
      if (readError) throw readError
      data = report
    } else if (config.url === '/reports') data = reportPage([report])
    else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
  vi.unstubAllGlobals()
})
async function show(path = `/admin/reports/${completedReport.id}`) {
  client.setQueryData(sessionKey, admin)
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await act(() => router.load())
  return router
}
const writes = () => requests.filter((r) => r.method === 'post')
async function open() {
  const user = userEvent.setup()
  const trigger = await screen.findByRole('button', { name: 'Close report' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', {
    name: `Close report · ${report.reportNumber}`,
  })
  return { user, trigger, dialog }
}
it.each([
  'REPORTED',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'CLOSED',
] as const)('hides closure for %s', async (status) => {
  report.status = status
  await show()
  await screen.findByRole('region', { name: 'Report information' })
  expect(
    screen.queryByRole('button', { name: 'Close report' }),
  ).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
it.each(['result', 'receipt', 'both'] as const)(
  'disables closure and explains missing %s',
  async (missing) => {
    if (missing !== 'receipt') report.maintenanceResult = null
    if (missing !== 'result') report.receipt = null
    await show()
    const trigger = await screen.findByRole('button', { name: 'Close report' })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAccessibleDescription(
      missing === 'both'
        ? 'A work result and receipt are required before closing this report.'
        : missing === 'result'
          ? 'A work result is required before closing this report.'
          : 'A receipt is required before closing this report.',
    )
    expect(writes()).toHaveLength(0)
  },
)
it('requires the receipt even when costs are zero', async () => {
  report.costItems = []
  report.totalCost = '0.00'
  report.receipt = null
  await show()
  expect(
    await screen.findByRole('button', { name: 'Close report' }),
  ).toBeDisabled()
})
it('closes with no costs or repair photos, updates audits, retains filters and focuses heading', async () => {
  report.costItems = []
  report.totalCost = '0.00'
  const router = await show(
    `/admin/reports/${report.id}?q=AC&status=COMPLETED&page=2&pageSize=50`,
  )
  const source = router.state.location.search
  const { user, dialog } = await open()
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('heading')).toHaveFocus()
  expect(writes()).toHaveLength(0)
  await user.click(within(dialog).getByRole('button', { name: 'Close report' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^Close report ·|Action in progress/,
      }),
    ).not.toBeInTheDocument(),
  )
  expect(writes()).toHaveLength(1)
  expect(writes()[0].data).toBeUndefined()
  expect(
    within(
      screen.getByRole('region', { name: 'Report information' }),
    ).getByText('Closed'),
  ).toBeInTheDocument()
  const record = screen.getByRole('region', { name: 'Record information' })
  expect(within(record).getByText('11 Oct 2026, 16:00')).toBeInTheDocument()
  expect(within(record).getByText(admin.name)).toBeInTheDocument()
  expect(screen.getByText('Report closed')).toBeInTheDocument()
  expect(router.state.location.search).toEqual(source)
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
})
it.each(['Escape', 'Cancel'] as const)(
  'dismisses via %s without a write and restores trigger focus',
  async (method) => {
    await show()
    const { user, trigger, dialog } = await open()
    if (method === 'Escape') await user.keyboard('{Escape}')
    else
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /^Close report ·/ }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(writes()).toHaveLength(0)
    await user.click(trigger)
    expect(
      await screen.findByRole('dialog', { name: /^Close report ·/ }),
    ).toBeInTheDocument()
  },
)
it('retains confirmation on ordinary failure and allows an explicit retry', async () => {
  writeError = new ApiError('Closure unavailable.', 'NETWORK_ERROR')
  await show()
  const { user, dialog } = await open()
  const confirm = within(dialog).getByRole('button', { name: 'Close report' })
  await user.click(confirm)
  expect(await screen.findByText('Closure unavailable.')).toBeInTheDocument()
  expect(dialog).toBeInTheDocument()
  expect(confirm).toBeEnabled()
  await waitFor(() => expect(confirm).toHaveFocus())
  writeError = undefined
  await user.click(confirm)
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /^Close report ·/ }),
    ).not.toBeInTheDocument(),
  )
  expect(writes()).toHaveLength(2)
})
it('locks pending closure and pauses detail reads without duplicate writes', async () => {
  let release!: () => void
  writeHold = new Promise((resolve) => {
    release = resolve
  })
  await show()
  const { user, dialog } = await open()
  await user.click(within(dialog).getByRole('button', { name: 'Close report' }))
  const loader = await screen.findByRole('dialog', {
    name: 'Action in progress',
  })
  expect(within(loader).getByRole('status')).toHaveTextContent(
    'Closing report…',
  )
  expect(
    within(dialog).getByRole('button', { name: 'Cancel', hidden: true }),
  ).toBeDisabled()
  await user.keyboard('{Tab}{Escape}{Enter}')
  expect(loader).toBeInTheDocument()
  expect(loader.contains(document.activeElement)).toBe(true)
  const reads = () =>
    requests.filter((r) => r.url === `/reports/${report.id}`).length
  const before = reads()
  await act(() =>
    client.invalidateQueries({ queryKey: reportDetailKey(report.id) }),
  )
  expect(reads()).toBe(before)
  expect(writes()).toHaveLength(1)
  await act(async () => {
    release()
  })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^Close report ·|Action in progress/,
      }),
    ).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
})
it.each(['status', 'result', 'receipt', 'eligible'] as const)(
  'handles background changes to %s',
  async (change) => {
    await show()
    const { dialog } = await open()
    if (change === 'status') report.status = 'CLOSED'
    else if (change === 'result') report.maintenanceResult = null
    else if (change === 'receipt') report.receipt = null
    await act(() =>
      client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
    )
    if (change === 'eligible') expect(dialog).toBeInTheDocument()
    else {
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: /^Close report ·/ }),
        ).not.toBeInTheDocument(),
      )
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
      )
    }
    expect(writes()).toHaveLength(0)
  },
)
it('closes confirmation when a background read returns 404', async () => {
  await show()
  await open()
  readError = new ApiError('Missing', 'NOT_FOUND', 404)
  await act(() =>
    client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Report not found')
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /^Close report ·/ }),
    ).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
})
it.each(['missing', 'closed', 'receipt', 'eligible'] as const)(
  'refreshes after a %s conflict without resubmitting',
  async (change) => {
    const status = change === 'missing' ? 404 : 409
    writeError = new ApiError(
      'Report changed.',
      status === 404 ? 'NOT_FOUND' : 'CONFLICT',
      status,
    )
    await show()
    const { user, dialog } = await open()
    if (change === 'missing')
      readError = new ApiError('Missing', 'NOT_FOUND', 404)
    if (change === 'closed')
      report = {
        ...report,
        status: 'CLOSED',
        closedAt: completedReport.closedAt,
        closedBy: completedReport.closedBy,
      }
    if (change === 'receipt') report.receipt = null
    await user.click(
      within(dialog).getByRole('button', { name: 'Close report' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /^Close report ·/ }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(
        requests.filter((r) => r.url === `/reports/${report.id}`),
      ).toHaveLength(2),
    )
    expect(writes()).toHaveLength(1)
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
    )
    if (change === 'missing')
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Report not found',
      )
    else if (change === 'closed')
      expect(
        screen.queryByRole('button', { name: 'Close report' }),
      ).not.toBeInTheDocument()
    else
      expect(
        screen.getByRole('button', { name: 'Close report' }),
      ).toHaveProperty('disabled', change === 'receipt')
  },
)
it('disables the trigger and confirmation while details refresh or have read errors', async () => {
  await show()
  const { dialog } = await open()
  let release!: () => void
  readHold = new Promise((resolve) => {
    release = resolve
  })
  readError = new ApiError('Read failed.', 'NETWORK_ERROR')
  let refresh!: Promise<void>
  act(() => {
    refresh = client.refetchQueries({ queryKey: reportDetailKey(report.id) })
  })
  await waitFor(() =>
    expect(
      within(dialog).getByRole('button', { name: 'Close report' }),
    ).toBeDisabled(),
  )
  await act(async () => {
    release()
    await refresh
  })
  expect(
    within(dialog).getByRole('button', { name: 'Close report' }),
  ).toBeDisabled()
  expect(writes()).toHaveLength(0)
})
