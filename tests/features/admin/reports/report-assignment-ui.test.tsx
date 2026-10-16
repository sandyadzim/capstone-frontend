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
import type { Account } from '@/features/admin/accounts/account-schema'
import { admin, property } from '../settings/fixtures'
import { account, accountPage } from '../accounts/fixtures'
import { reportDetail, reportPage } from './fixtures'

const original = apiClient.defaults.adapter
const technician: Account = {
  ...account,
  name: 'Alex Technician',
  role: 'TECHNICIAN',
  activeUnit: null,
}
const other: Account = {
  ...technician,
  id: '33000000-0000-4000-8000-000000000004',
  name: 'Sam Technician',
  loginIdentifier: 'sam@example.test',
}
const assigned = {
  id: '44000000-0000-4000-8000-000000000004',
  technician: { id: technician.id, name: technician.name },
  assignedBy: { id: admin.id, name: admin.name },
  assignedAt: '2026-10-11T09:00:00.000Z',
  estimatedArrivalAt: null,
  note: null,
}
let client: ReturnType<typeof createQueryClient>
let report: ReportDetail
let readError: ApiError | undefined
let readHold: Promise<void> | undefined
let optionsError: ApiError | undefined
let optionsHold: Promise<void> | undefined
let options: Account[]
let total: number
let requests: AxiosRequestConfig[]
let writeError: ApiError | undefined
let writeHold: Promise<void> | undefined
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  report = {
    ...structuredClone(reportDetail),
    status: 'VERIFIED',
    finalPriority: 'MEDIUM',
  }
  readError = undefined
  readHold = undefined
  optionsError = undefined
  optionsHold = undefined
  options = [technician, other]
  total = 100
  requests = []
  writeError = undefined
  writeHold = undefined
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = admin
    else if (config.url === '/property') data = property
    else if (config.url === '/accounts') {
      if (optionsHold) await optionsHold
      if (optionsError) throw optionsError
      const { page = 1, pageSize = 20, q = '' } = config.params ?? {}
      data = accountPage(
        options.filter((a) =>
          `${a.name} ${a.loginIdentifier}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        ),
        page,
        pageSize,
        total,
      )
    } else if (
      config.method === 'post' &&
      config.url === `/reports/${report.id}/assign`
    ) {
      if (writeHold) await writeHold
      if (writeError) throw writeError
      const values = JSON.parse(config.data)
      const person = options.find((a) => a.id === values.technicianUserId)!
      report = {
        ...report,
        status: 'ASSIGNED',
        assignment: {
          ...assigned,
          technician: { id: person.id, name: person.name },
          note: values.note ?? null,
        },
      }
      data = report
    } else if (config.url === `/reports/${reportDetail.id}`) {
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
const reads = () => requests.filter((r) => r.url === '/accounts')
async function open() {
  const user = userEvent.setup()
  const trigger = await screen.findByRole('button', {
    name: 'Assign technician',
  })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', {
    name: `Assign technician · ${report.reportNumber}`,
  })
  return { user, trigger, dialog }
}
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  name = technician.name,
) {
  // jsdom does not evaluate container-query visibility; both layouts exist.
  await user.click(
    (
      await within(dialog).findAllByRole('button', {
        name: `Select technician ${name}`,
      })
    )[0],
  )
}
it.each([
  'REPORTED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
] as const)('hides assignment for %s', async (status) => {
  report.status = status
  await show()
  await screen.findByRole('region', { name: 'Report information' })
  expect(
    screen.queryByRole('button', { name: 'Assign technician' }),
  ).not.toBeInTheDocument()
  expect(reads()).toHaveLength(0)
})
it('hides assignment when a Verified report already has an assignment', async () => {
  report.assignment = assigned
  await show()
  await screen.findByRole('region', { name: 'Report information' })
  expect(
    screen.queryByRole('button', { name: 'Assign technician' }),
  ).not.toBeInTheDocument()
})
it('submits a replacement selection, updates recorded assignment and preserves source filters/focus', async () => {
  const router = await show(
    `/admin/reports/${report.id}?q=AC&status=VERIFIED&page=2&pageSize=50`,
  )
  const source = router.state.location.search
  expect(reads()).toHaveLength(0)
  const { user, dialog } = await open()
  await choose(user, dialog)
  const note = within(dialog).getByRole('textbox', {
    name: 'Assignment note (optional)',
  })
  await user.type(note, '  Visit tomorrow.  ')
  expect(
    within(dialog).queryByRole('searchbox', { name: 'Search technicians' }),
  ).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Change' }))
  await choose(user, dialog, other.name)
  expect(note).toHaveValue('  Visit tomorrow.  ')
  await user.click(
    within(dialog).getByRole('button', { name: 'Assign technician' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /^Assign technician ·/ }),
    ).not.toBeInTheDocument(),
  )
  expect(writes()).toHaveLength(1)
  expect(JSON.parse(writes()[0].data)).toEqual({
    technicianUserId: other.id,
    note: 'Visit tomorrow.',
  })
  const section = screen.getByRole('region', { name: 'Technician assignment' })
  expect(within(section).getByText(other.name)).toBeInTheDocument()
  expect(within(section).getByText('Visit tomorrow.')).toBeInTheDocument()
  expect(
    within(section).getByText('Estimated arrival').nextElementSibling,
  ).toHaveTextContent('—')
  expect(screen.getByText('Technician assigned')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
  expect(router.state.location.search).toEqual(source)
})
it('requires a selection, focuses the selection area and clears the error on selection', async () => {
  await show()
  const { user, dialog } = await open()
  await user.click(
    within(dialog).getByRole('button', { name: 'Assign technician' }),
  )
  expect(
    await within(dialog).findByText('Choose a technician.'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByRole('group', { name: 'Technician' }),
  ).toHaveFocus()
  await choose(user, dialog)
  expect(
    within(dialog).queryByText('Choose a technician.'),
  ).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
it('uses fixed eligibility filters, debounced search, pagination and all supported page sizes', async () => {
  await show()
  const { user, dialog } = await open()
  await waitFor(() => expect(reads()).toHaveLength(1))
  expect(reads()[0].params).toEqual({
    role: 'TECHNICIAN',
    isActive: 'true',
    page: 1,
    pageSize: 20,
  })
  await user.click(within(dialog).getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(reads().at(-1)?.params.page).toBe(2))
  expect(
    within(dialog).getByRole('group', { name: 'Technician' }),
  ).toHaveFocus()
  const search = within(dialog).getByRole('searchbox', {
    name: 'Search technicians',
  })
  expect(search).toHaveAttribute('maxlength', '254')
  await user.type(search, 'sam')
  expect(reads().at(-1)?.params.q).toBeUndefined()
  await waitFor(() =>
    expect(reads().at(-1)?.params).toMatchObject({ q: 'sam', page: 1 }),
  )
  const pageSize = within(dialog).getByRole('combobox', { name: 'Page size' })
  await waitFor(() => expect(pageSize).toBeEnabled())
  await user.click(pageSize)
  await screen.findByRole('option', { name: '10' })
  for (const size of [10, 20, 50, 100])
    expect(
      screen.getByRole('option', { name: String(size) }),
    ).toBeInTheDocument()
  await user.click(screen.getByRole('option', { name: '50' }))
  await waitFor(() =>
    expect(reads().at(-1)?.params).toMatchObject({
      q: 'sam',
      page: 1,
      pageSize: 50,
    }),
  )
})
it('clears draft/search/page on Escape and Cancel and restores trigger focus', async () => {
  await show()
  const { user, trigger, dialog } = await open()
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Assignment note (optional)' }),
    'Discard',
  )
  await user.type(
    within(dialog).getByRole('searchbox', { name: 'Search technicians' }),
    'sam',
  )
  await waitFor(() => expect(reads().at(-1)?.params.q).toBe('sam'))
  await choose(user, dialog, other.name)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  await user.click(trigger)
  const reopened = await screen.findByRole('dialog', {
    name: /^Assign technician ·/,
  })
  expect(
    within(reopened).getByRole('textbox', {
      name: 'Assignment note (optional)',
    }),
  ).toHaveValue('')
  expect(
    within(reopened).getByRole('searchbox', { name: 'Search technicians' }),
  ).toHaveValue('')
  expect(
    within(reopened).queryByRole('button', { name: 'Change' }),
  ).not.toBeInTheDocument()
  await user.click(within(reopened).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(trigger).toHaveFocus())
})
it('shows skeleton, retry and both empty messages', async () => {
  let release!: () => void
  optionsHold = new Promise((resolve) => {
    release = resolve
  })
  optionsError = new ApiError('Accounts unavailable.', 'NETWORK_ERROR')
  await show()
  const { user, dialog } = await open()
  expect(
    within(dialog).getByText('Loading active technicians…'),
  ).toBeInTheDocument()
  await act(async () => {
    release()
  })
  expect(
    await within(dialog).findByText('Accounts unavailable.'),
  ).toBeInTheDocument()
  optionsError = undefined
  options = []
  total = 0
  await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
  expect(
    await within(dialog).findByText('No active technicians available'),
  ).toBeInTheDocument()
  await user.type(
    within(dialog).getByRole('searchbox', { name: 'Search technicians' }),
    'missing',
  )
  expect(
    await within(dialog).findByText('No technicians match your search'),
  ).toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
it('prevents selecting inactive/non-technician and stale records', async () => {
  options = [
    { ...technician, isActive: false },
    { ...other, role: 'RESIDENT' },
  ]
  await show()
  const { user, dialog } = await open()
  for (const button of await within(dialog).findAllByRole('button', {
    name: /Select technician/,
  }))
    expect(button).toBeDisabled()
  options = [technician]
  let release!: () => void
  optionsHold = new Promise((resolve) => {
    release = resolve
  })
  let refresh!: Promise<void>
  act(() => {
    refresh = client.refetchQueries({ queryKey: ['admin', 'accounts'] })
  })
  await waitFor(() =>
    expect(
      within(dialog).getByText('Updating active technicians…'),
    ).toBeInTheDocument(),
  )
  for (const button of within(dialog).getAllByRole('button', {
    name: /Select technician/,
  }))
    expect(button).toBeDisabled()
  await act(async () => {
    release()
    await refresh
  })
  await choose(user, dialog)
})
it('retains the draft after ordinary failure, maps fields and allows explicit retry', async () => {
  writeError = new ApiError('Invalid assignment.', 'VALIDATION_ERROR', 400, {
    issues: [
      { path: ['technicianUserId'], message: 'Select a different technician.' },
      { path: ['note'], message: 'Clarify the assignment note.' },
      { path: ['status'], message: 'Ignore this' },
    ],
  })
  await show()
  const { user, dialog } = await open()
  await choose(user, dialog)
  const note = within(dialog).getByRole('textbox', {
    name: 'Assignment note (optional)',
  })
  await user.type(note, 'Keep this')
  await user.click(
    within(dialog).getByRole('button', { name: 'Assign technician' }),
  )
  expect(
    await within(dialog).findByText('Select a different technician.'),
  ).toBeInTheDocument()
  expect(within(dialog).getByText(technician.name)).toBeInTheDocument()
  expect(note).toHaveValue('Keep this')
  await waitFor(() =>
    expect(
      within(dialog).getByRole('group', { name: 'Technician' }),
    ).toHaveFocus(),
  )
  writeError = new ApiError('Assignment unavailable.', 'NETWORK_ERROR')
  await user.click(
    within(dialog).getByRole('button', { name: 'Assign technician' }),
  )
  expect(await screen.findByText('Assignment unavailable.')).toBeInTheDocument()
  expect(note).toHaveValue('Keep this')
  writeError = undefined
  await user.type(note, ' clarified')
  await user.click(
    within(dialog).getByRole('button', { name: 'Assign technician' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /^Assign technician ·/ }),
    ).not.toBeInTheDocument(),
  )
  expect(writes()).toHaveLength(3)
})
it('locks pending submissions without dismissing the form or refetching report details', async () => {
  let release!: () => void
  writeHold = new Promise((resolve) => {
    release = resolve
  })
  await show()
  const { user, dialog } = await open()
  await choose(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Assign technician' }),
  )
  const loader = await screen.findByRole('dialog', {
    name: 'Action in progress',
  })
  expect(within(loader).getByRole('status')).toHaveTextContent(
    'Assigning technician…',
  )
  await user.keyboard('{Tab}{Escape}{Enter}')
  expect(loader).toBeInTheDocument()
  expect(loader.contains(document.activeElement)).toBe(true)
  const reportReads = () =>
    requests.filter((r) => r.url === `/reports/${report.id}`).length
  const before = reportReads()
  await act(() =>
    client.invalidateQueries({ queryKey: reportDetailKey(report.id) }),
  )
  expect(reportReads()).toBe(before)
  expect(writes()).toHaveLength(1)
  await act(async () => {
    release()
  })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^Assign technician ·|Action in progress/,
      }),
    ).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
})
it.each([404, 409])(
  'retains note but clears selection and refreshes technicians after technician HTTP %s',
  async (status) => {
    writeError = new ApiError(
      'Technician changed.',
      status === 404 ? 'NOT_FOUND' : 'CONFLICT',
      status,
    )
    await show()
    const { user, dialog } = await open()
    await choose(user, dialog)
    await user.type(
      within(dialog).getByRole('textbox', {
        name: 'Assignment note (optional)',
      }),
      'Keep after conflict',
    )
    options = [other]
    await user.click(
      within(dialog).getByRole('button', { name: 'Assign technician' }),
    )
    expect(
      await within(dialog).findByRole('searchbox', {
        name: 'Search technicians',
      }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('textbox', {
        name: 'Assignment note (optional)',
      }),
    ).toHaveValue('Keep after conflict')
    await waitFor(() => expect(reads()).toHaveLength(2))
    expect(within(dialog).queryByText(technician.name)).not.toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Assign technician' }),
    )
    expect(
      await within(dialog).findByText('Choose a technician.'),
    ).toBeInTheDocument()
    expect(writes()).toHaveLength(1)
    writeError = undefined
    await choose(user, dialog, other.name)
    await user.click(
      within(dialog).getByRole('button', { name: 'Assign technician' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /^Assign technician ·/ }),
      ).not.toBeInTheDocument(),
    )
    expect(writes()).toHaveLength(2)
  },
)
it.each([404, 409])(
  'closes obsolete assignment after report HTTP %s',
  async (status) => {
    writeError = new ApiError(
      'Report changed.',
      status === 404 ? 'NOT_FOUND' : 'CONFLICT',
      status,
    )
    await show()
    const { user, dialog } = await open()
    await choose(user, dialog)
    if (status === 404) readError = new ApiError('Missing', 'NOT_FOUND', 404)
    else report = { ...report, status: 'ASSIGNED', assignment: assigned }
    await user.click(
      within(dialog).getByRole('button', { name: 'Assign technician' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /^Assign technician ·/ }),
      ).not.toBeInTheDocument(),
    )
    if (status === 404)
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Report not found',
      )
    else
      expect(
        await screen.findByRole('region', { name: 'Technician assignment' }),
      ).toBeInTheDocument()
    expect(writes()).toHaveLength(1)
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
    )
    await waitFor(() => expect(reads()).toHaveLength(2))
  },
)
it('preserves an eligible draft during refresh and closes it for a new assignment', async () => {
  await show()
  const { user, dialog } = await open()
  await choose(user, dialog)
  const note = within(dialog).getByRole('textbox', {
    name: 'Assignment note (optional)',
  })
  await user.type(note, 'Keep draft')
  await act(() =>
    client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
  )
  expect(note).toHaveValue('Keep draft')
  expect(within(dialog).getByText(technician.name)).toBeInTheDocument()
  report = { ...report, assignment: assigned }
  await act(() =>
    client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /^Assign technician ·/ }),
    ).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
  )
  expect(writes()).toHaveLength(0)
})
it('disables assignment while report details refresh or have a read error', async () => {
  await show()
  const trigger = await screen.findByRole('button', {
    name: 'Assign technician',
  })
  let release!: () => void
  readHold = new Promise((resolve) => {
    release = resolve
  })
  readError = new ApiError('Read failed', 'NETWORK_ERROR')
  let refresh!: Promise<void>
  act(() => {
    refresh = client.refetchQueries({ queryKey: reportDetailKey(report.id) })
  })
  await waitFor(() => expect(trigger).toBeDisabled())
  await act(async () => {
    release()
    await refresh
  })
  expect(trigger).toBeDisabled()
  expect(reads()).toHaveLength(0)
})
