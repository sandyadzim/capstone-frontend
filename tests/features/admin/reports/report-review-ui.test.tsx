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
import { type ReportDetail } from '@/features/admin/reports/report-schema'
import { admin, property } from '../settings/fixtures'
import { reportDetail, reportPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let report: ReportDetail
let readError: ApiError | undefined
let hold: Promise<void> | undefined
let requests: AxiosRequestConfig[]
let writeError: ApiError | undefined
let writeHold: Promise<void> | undefined
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  report = structuredClone(reportDetail)
  readError = undefined
  hold = undefined
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
      config.url?.startsWith(`/reports/${reportDetail.id}/`)
    ) {
      if (writeHold) await writeHold
      if (writeError) throw writeError
      const values = JSON.parse(config.data)
      report = {
        ...report,
        ...values,
        status: config.url.endsWith('/verify') ? 'VERIFIED' : 'REJECTED',
        reviewedBy: { id: admin.id, name: admin.name },
      }
      data = report
    } else if (config.url === `/reports/${reportDetail.id}`) {
      if (hold) await hold
      if (readError) throw readError
      data = report
    } else if (config.url === '/reports') {
      const { page = 1, pageSize = 20 } = config.params ?? {}
      data = reportPage([report], page, pageSize, 100)
    } else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
  vi.unstubAllGlobals()
})
async function show(path = `/admin/reports/${reportDetail.id}`) {
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
async function open(decision: 'Verify' | 'Reject') {
  const user = userEvent.setup()
  const trigger = await screen.findByRole('button', {
    name: decision,
  })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', {
    name: `${decision} ${report.reportNumber}`,
  })
  return { user, trigger, dialog }
}
it.each(['Verify', 'Reject'] as const)(
  'submits %s, updates details, retains source state and focuses the heading',
  async (decision) => {
    const router = await show(
      `/admin/reports/${report.id}?q=AC&status=REPORTED&page=2&pageSize=50`,
    )
    const originalSearch = router.state.location.search
    const { user, dialog } = await open(decision)
    expect(
      within(dialog).getByRole('combobox', { name: 'Final priority' }),
    ).toHaveTextContent('Medium')
    await user.click(
      within(dialog).getByRole('combobox', { name: 'Final priority' }),
    )
    await user.click(await screen.findByRole('option', { name: 'High' }))
    if (decision === 'Reject')
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Rejection reason' }),
        '  Duplicate report.  ',
      )
    await user.type(
      within(dialog).getByRole('textbox', {
        name: 'Internal review note (optional)',
      }),
      '  Internal note.  ',
    )
    await user.click(
      within(dialog).getByRole('button', { name: `${decision} report` }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /^(Verify RPT|Reject RPT|Action in progress)/,
        }),
      ).not.toBeInTheDocument(),
    )
    expect(writes()).toHaveLength(1)
    expect(JSON.parse(writes()[0].data)).toEqual({
      finalPriority: 'HIGH',
      reviewNote: 'Internal note.',
      ...(decision === 'Reject'
        ? { rejectionReason: 'Duplicate report.' }
        : {}),
    })
    const overview = screen.getByRole('region', { name: 'Report information' })
    expect(
      within(overview).getByText(
        decision === 'Verify' ? 'Verified' : 'Rejected',
      ),
    ).toBeInTheDocument()
    const review = screen.getByRole('region', { name: 'Review' })
    expect(within(review).getByText(admin.name)).toBeInTheDocument()
    expect(within(review).getByText('Internal note.')).toBeInTheDocument()
    expect(
      screen.getByText(
        decision === 'Verify' ? 'Report verified' : 'Report rejected',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
    )
    expect(router.state.location.search).toEqual(originalSearch)
    expect(
      screen.queryByRole('button', { name: decision }),
    ).not.toBeInTheDocument()
  },
)
it('requires explicit priority when none was proposed and focuses the first error', async () => {
  report.proposedPriority = null
  await show()
  const { user, dialog } = await open('Reject')
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject report' }),
  )
  expect(
    await within(dialog).findByText('Choose a final priority.'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByRole('combobox', { name: 'Final priority' }),
  ).toHaveFocus()
  expect(
    within(dialog).getByText('Enter a rejection reason.'),
  ).toBeInTheDocument()
  expect(writes()).toHaveLength(0)
  await user.click(
    within(dialog).getByRole('combobox', { name: 'Final priority' }),
  )
  await user.click(await screen.findByRole('option', { name: 'Low' }))
  await waitFor(() =>
    expect(
      within(dialog).queryByText('Choose a final priority.'),
    ).not.toBeInTheDocument(),
  )
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Rejection reason' }),
    '   ',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject report' }),
  )
  expect(
    within(dialog).getByRole('textbox', { name: 'Rejection reason' }),
  ).toHaveFocus()
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Rejection reason' }),
    'Valid reason',
  )
  await waitFor(() =>
    expect(
      within(dialog).queryByText('Enter a rejection reason.'),
    ).not.toBeInTheDocument(),
  )
})
it.each(['Verify', 'Reject'] as const)(
  'clears %s drafts on Cancel/Escape and restores the trigger',
  async (decision) => {
    await show()
    const { user, trigger, dialog } = await open(decision)
    await user.type(
      within(dialog).getByRole('textbox', {
        name: 'Internal review note (optional)',
      }),
      'Discard this',
    )
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /^(Verify RPT|Reject RPT|Action in progress)/,
        }),
      ).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    const reopened = await screen.findByRole('dialog', {
      name: `${decision} ${report.reportNumber}`,
    })
    expect(
      within(reopened).getByRole('textbox', {
        name: 'Internal review note (optional)',
      }),
    ).toHaveValue('')
    await user.click(within(reopened).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(writes()).toHaveLength(0)
  },
)
it('retains drafts on ordinary and field failures, then allows an explicit retry', async () => {
  writeError = new ApiError('Reason invalid.', 'VALIDATION_ERROR', 400, {
    issues: [
      { path: ['rejectionReason'], message: 'Please give a clearer reason.' },
      { path: ['unknown'], message: 'Ignore' },
    ],
  })
  await show()
  const { user, dialog } = await open('Reject')
  const reason = within(dialog).getByRole('textbox', {
    name: 'Rejection reason',
  })
  await user.type(reason, 'Existing reason')
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject report' }),
  )
  expect(
    await within(dialog).findByText('Please give a clearer reason.'),
  ).toBeInTheDocument()
  expect(reason).toHaveValue('Existing reason')
  await waitFor(() => expect(reason).toHaveFocus())
  writeError = new ApiError('Connection failed.', 'NETWORK_ERROR')
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject report' }),
  )
  expect(await screen.findByText('Connection failed.')).toBeInTheDocument()
  expect(reason).toHaveValue('Existing reason')
  expect(writes()).toHaveLength(2)
  writeError = undefined
  await user.type(reason, ' clarified')
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject report' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^(Verify RPT|Reject RPT|Action in progress)/,
      }),
    ).not.toBeInTheDocument(),
  )
  expect(writes()).toHaveLength(3)
})
it.each(['Verify', 'Reject'] as const)(
  'locks the page and prevents dismissal during %s',
  async (decision) => {
    let release!: () => void
    writeHold = new Promise((resolve) => {
      release = resolve
    })
    await show()
    const { user, dialog } = await open(decision)
    if (decision === 'Reject')
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Rejection reason' }),
        'Duplicate',
      )
    await user.click(
      within(dialog).getByRole('button', { name: `${decision} report` }),
    )
    const loader = await screen.findByRole('dialog', {
      name: 'Action in progress',
    })
    expect(within(loader).getByRole('status')).toHaveTextContent('Loading…')
    await user.keyboard('{Tab}{Escape}')
    expect(loader).toBeInTheDocument()
    expect(loader.contains(document.activeElement)).toBe(true)
    expect(writes()).toHaveLength(1)
    await act(async () => {
      release()
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /^(Verify RPT|Reject RPT|Action in progress)/,
        }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
    )
  },
)
it.each([404, 409])(
  'closes an obsolete form and refreshes after HTTP %s',
  async (status) => {
    writeError = new ApiError(
      status === 409 ? 'Report is already VERIFIED.' : 'Missing',
      status === 409 ? 'CONFLICT' : 'NOT_FOUND',
      status,
    )
    await show()
    const { user, dialog } = await open('Verify')
    report = { ...report, status: 'VERIFIED' }
    if (status === 404) readError = new ApiError('Missing', 'NOT_FOUND', 404)
    await user.click(
      within(dialog).getByRole('button', { name: 'Verify report' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /^(Verify RPT|Reject RPT|Action in progress)/,
        }),
      ).not.toBeInTheDocument(),
    )
    expect(writes()).toHaveLength(1)
    if (status === 409)
      expect(await screen.findByText('Verified')).toBeInTheDocument()
    else
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Report not found',
      )
    expect(
      screen.queryByRole('button', { name: 'Verify' }),
    ).not.toBeInTheDocument()
    expect(
      requests.filter(
        (r) => r.method === 'get' && r.url === `/reports/${report.id}`,
      ).length,
    ).toBeGreaterThanOrEqual(2)
  },
)
it('keeps an open draft through refresh and closes it when status changes', async () => {
  await show()
  const { user, dialog } = await open('Verify')
  const note = within(dialog).getByRole('textbox', {
    name: 'Internal review note (optional)',
  })
  await user.type(note, 'Keep this draft')
  await act(() =>
    client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
  )
  expect(note).toHaveValue('Keep this draft')
  report = { ...report, status: 'VERIFIED' }
  await act(() =>
    client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^(Verify RPT|Reject RPT|Action in progress)/,
      }),
    ).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
  expect(writes()).toHaveLength(0)
})
it('disables review during background reads and read failures', async () => {
  await show()
  const verify = await screen.findByRole('button', {
    name: 'Verify',
  })
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  readError = new ApiError('Read failed.', 'NETWORK_ERROR')
  let refresh!: Promise<void>
  act(() => {
    refresh = client.refetchQueries({ queryKey: reportDetailKey(report.id) })
  })
  await waitFor(() => expect(verify).toBeDisabled())
  await act(async () => {
    release()
    await refresh
  })
  expect(verify).toBeDisabled()
  expect(writes()).toHaveLength(0)
})
