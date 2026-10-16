// @vitest-environment jsdom
import type { AxiosRequestConfig } from 'axios'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { sessionKey } from '@/features/auth/auth-session'
import { reportStatusLabels } from '@/features/admin/reports/report-labels'
import {
  reportStatusSchema,
  type ReportDetail,
} from '@/features/admin/reports/report-schema'
import {
  residentReportDetailQueryOptions,
  residentUnitQueryOptions,
} from '@/features/resident/resident-queries'
import {
  completedReport,
  photo,
  reportDetail,
  reportPage,
} from '../admin/reports/fixtures'
import { property } from '../admin/settings/fixtures'

const resident = {
  id: '33000000-0000-4000-8000-000000000003',
  name: 'Maya Aditya',
  loginIdentifier: 'maya',
  role: 'RESIDENT' as const,
}
const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let report: ReportDetail
let unit: typeof reportDetail.unit | null
let readError: ApiError | undefined
let unitError: ApiError | undefined
let holdReport: Promise<void> | undefined
let holdUnit: Promise<void> | undefined
let requests: AxiosRequestConfig[]

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  report = structuredClone(reportDetail)
  // The resident API omits these optional admin fields entirely.
  for (const key of [
    'reviewNote',
    'createdBy',
    'reportedBy',
    'reviewedBy',
    'closedBy',
    'costItems',
  ] as const)
    delete report[key]
  unit = { ...report.unit }
  readError = unitError = undefined
  holdReport = holdUnit = undefined
  requests = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') {
      if (readError?.statusCode === 401) throw readError
      data = resident
    } else if (config.url === '/resident/unit') {
      await holdUnit
      if (unitError) throw unitError
      data = { unit }
    } else if (config.url === '/property') data = property
    else if (config.url === '/reports') data = reportPage([report], 1, 10)
    else if (config.url?.startsWith('/reports/')) {
      const snapshot = structuredClone(report)
      await holdReport
      if (readError) throw readError
      data = snapshot
    } else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})

afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})

async function show(
  path = `/reports/${report.id}`,
  role: 'RESIDENT' | 'ADMIN' = 'RESIDENT',
) {
  client.setQueryData(sessionKey, { ...resident, role })
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await act(() => router.load())
  return { router, ...view }
}

const detailKey = () =>
  residentReportDetailQueryOptions(
    resident.id,
    reportDetail.unit.id,
    reportDetail.id,
  ).queryKey
const detailRequests = () =>
  requests.filter((request) => request.url?.startsWith('/reports/'))
const overview = () => screen.findByRole('region', { name: 'Report overview' })

it.each(reportStatusSchema.options)(
  'loads a direct %s link with resident-safe details',
  async (status) => {
    report.status = status
    await show()
    await overview()
    expect(
      within(screen.getByRole('region', { name: 'Report status' })).getByText(
        reportStatusLabels[status],
        { exact: true },
      ),
    ).toBeVisible()
    expect(screen.getByText(report.reportNumber)).toBeVisible()
    expect(screen.getByText('2 Oct 2026, 01:30')).toBeVisible()
    expect(
      screen.getByText(
        (_text, node) => node?.textContent === report.description,
      ),
    ).toHaveClass('whitespace-pre-wrap')
    expect(screen.getByText('No damage photos')).toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: 'Progress' }))
    const progress = screen.getByRole('list', { name: 'Report progress' })
    const currentStep = progress.querySelector('[aria-current="step"]')
    expect(currentStep).toHaveTextContent(
      `${reportStatusLabels[status]}Current`,
    )
    expect(within(progress).getAllByRole('listitem')).toHaveLength(
      status === 'REJECTED' ? 2 : 6,
    )
    expect(
      screen.queryByRole('region', { name: 'Your technician' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Work result' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Created by')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(detailRequests()).toHaveLength(1)
    expect(detailRequests()[0]).toMatchObject({
      url: `/reports/${report.id}`,
      method: 'get',
      withCredentials: true,
    })
    expect(detailRequests()[0].signal).toBeDefined()
  },
)

it('opens a card by keyboard and returns home', async () => {
  const { router } = await show('/')
  const link = await screen.findByRole('link', {
    name: `View report: ${report.title}`,
  })
  link.focus()
  await userEvent.keyboard('{Enter}')
  await overview()
  expect(router.state.location.pathname).toBe(`/reports/${report.id}`)
  await userEvent.click(screen.getByRole('link', { name: 'Back to home' }))
  expect(
    await screen.findByRole('heading', { name: /Welcome home/ }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/')
})

it('uses keyboard tabs without making extra requests and explains unavailable work', async () => {
  await show()
  await overview()
  const overviewTab = screen.getByRole('tab', { name: 'Overview' })
  expect(overviewTab).toHaveAttribute('aria-selected', 'true')
  overviewTab.focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Progress' })).toHaveFocus()
  expect(screen.getByRole('tabpanel', { name: 'Progress' })).toHaveAttribute(
    'id',
    'resident-report-panel',
  )
  expect(screen.queryByText(report.description)).not.toBeInTheDocument()
  await userEvent.keyboard('{End}')
  expect(screen.getByRole('tab', { name: 'Work' })).toHaveFocus()
  expect(
    screen.getByText('A technician hasn’t been assigned yet.'),
  ).toBeVisible()
  expect(
    screen.getByText('Work results will appear here when they’re available.'),
  ).toBeVisible()
  await userEvent.keyboard('{Home}{ArrowLeft}')
  expect(screen.getByRole('tab', { name: 'Work' })).toHaveFocus()
  await userEvent.keyboard('{ArrowRight}{Tab}')
  expect(screen.getByRole('tabpanel', { name: 'Overview' })).toHaveFocus()
  expect(detailRequests()).toHaveLength(1)
})

it('retains the selected tab on background updates and resets it for another report', async () => {
  const { router } = await show()
  await overview()
  await userEvent.click(screen.getByRole('tab', { name: 'Work' }))
  report.status = 'IN_PROGRESS'
  await act(async () => {
    await client.refetchQueries({ queryKey: detailKey() })
  })
  expect(screen.getByRole('tab', { name: 'Work' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(
    await within(
      screen.getByRole('region', { name: 'Report status' }),
    ).findByText('In progress', { exact: true }),
  ).toBeVisible()
  report = {
    ...report,
    id: '55000000-0000-4000-8000-000000000002',
    title: 'Kitchen leak',
  }
  await act(async () => {
    await router.navigate({
      to: '/reports/$reportId',
      params: { reportId: report.id },
    })
  })
  expect(await screen.findByText('Kitchen leak')).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

it('renders available work information without exposing admin-only fields or actions', async () => {
  report = structuredClone(completedReport)
  report.totalCost = '9007199254740993.01'
  await show()
  await overview()
  expect(screen.getByText('4 Oct 2026, 15:00')).toBeVisible()
  await userEvent.click(screen.getByRole('tab', { name: 'Work' }))
  expect(screen.getByText('Technician', { selector: 'p' })).toBeVisible()
  expect(screen.getByText('2 Oct 2026, 12:00')).toBeVisible()
  expect(screen.getByText('Bring tools.')).toBeVisible()
  expect(screen.getByText('Loose connection.')).toBeVisible()
  expect(screen.getByText('Reconnected the cable.')).toBeVisible()
  expect(screen.getByText('Rp 9.007.199.254.740.993,01')).toBeVisible()
  for (const text of [
    'Internal note.',
    'Reviewer',
    'Closer',
    'Assigner',
    'Service charge',
    'Replacement connector',
    'No receipt',
    'Additional notes',
  ])
    expect(screen.queryByText(text, { exact: false })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: /receipt/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', {
      name: /verify|reject|close report|assign technician|edit/i,
    }),
  ).not.toBeInTheDocument()
  expect(within(await overview()).getByText('High')).toBeVisible()
  expect(within(await overview()).queryByText('Medium')).not.toBeInTheDocument()
})

it('shows assignment placeholders, rejection reason, and additional notes only when supplied', async () => {
  report = {
    ...completedReport,
    status: 'REJECTED',
    rejectionReason: 'Duplicate request.',
    assignment: {
      ...completedReport.assignment!,
      technician: null,
      estimatedArrivalAt: null,
      note: null,
    },
    maintenanceResult: {
      ...completedReport.maintenanceResult!,
      additionalNotes: 'Keep the vent clear.',
    },
  }
  await show()
  await overview()
  expect(screen.getByText('Duplicate request.')).toBeVisible()
  await userEvent.click(screen.getByRole('tab', { name: 'Work' }))
  expect(screen.getAllByText('Not provided yet')).toHaveLength(2)
  expect(screen.getByText('Keep the vent clear.')).toBeVisible()
  expect(screen.queryByText('Assignment note')).not.toBeInTheDocument()
})

it('supports repair photos without a work result and omits an unfinished zero cost', async () => {
  report.repairPhotos = [photo]
  await show()
  await overview()
  await userEvent.click(screen.getByRole('tab', { name: 'Work' }))
  expect(screen.getByRole('region', { name: 'Work result' })).toBeVisible()
  expect(screen.queryByText('Total cost (IDR)')).not.toBeInTheDocument()
})

it('shows a completed zero cost without claiming payment or itemized costs', async () => {
  report.status = 'COMPLETED'
  await show()
  await overview()
  await userEvent.click(screen.getByRole('tab', { name: 'Work' }))
  expect(await screen.findByText('Rp 0,00')).toBeVisible()
  expect(screen.queryByText('No cost items')).not.toBeInTheDocument()
})

it('previews photos, restores keyboard focus, and handles broken images', async () => {
  report.damagePhotos = [photo]
  await show()
  const trigger = await screen.findByRole('button', {
    name: 'View damage photo 1',
  })
  trigger.focus()
  await userEvent.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
  expect(
    within(dialog).getByRole('img', { name: 'Damage photo 1' }),
  ).toHaveAttribute('src', photo.fileUrl)
  await userEvent.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(trigger).toHaveFocus()
  fireEvent.error(screen.getByRole('img', { name: 'Damage photo 1' }))
  expect(screen.getByText('Image unavailable')).toBeVisible()
})

it('does not request an invalid report ID', async () => {
  await show('/reports/invalid')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid report ID',
  )
  expect(detailRequests()).toHaveLength(0)
})

it('waits for confirmed placement and shows a skeleton during the detail read', async () => {
  let releaseUnit!: () => void
  let releaseReport!: () => void
  holdUnit = new Promise((resolve) => {
    releaseUnit = resolve
  })
  holdReport = new Promise((resolve) => {
    releaseReport = resolve
  })
  await show()
  expect(
    screen.getByRole('status', { name: 'Loading report details' }),
  ).toBeVisible()
  expect(detailRequests()).toHaveLength(0)
  await act(async () => releaseUnit())
  await waitFor(() => expect(detailRequests()).toHaveLength(1))
  expect(
    screen.getByRole('status', { name: 'Loading report details' }),
  ).toBeVisible()
  await act(async () => releaseReport())
  await overview()
})

it('gates unassigned residents without a detail request', async () => {
  unit = null
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent('No unit assigned')
  expect(detailRequests()).toHaveLength(0)
})

it('retries failed placement before requesting details', async () => {
  unitError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t confirm your unit',
  )
  expect(detailRequests()).toHaveLength(0)
  unitError = undefined
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await overview()
})

it('retries an initial detail failure without automatic retries', async () => {
  readError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t load this report',
  )
  expect(detailRequests()).toHaveLength(1)
  readError = undefined
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await overview()
  expect(detailRequests()).toHaveLength(2)
})

it('retains details after an ordinary background failure', async () => {
  await show()
  await overview()
  readError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await act(async () => {
    await client.refetchQueries({ queryKey: detailKey() })
  })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Showing the last available information',
  )
  expect(await overview()).toBeVisible()
})

it.each([403, 404])(
  'hides cached data after access is lost with %s',
  async (code) => {
    await show()
    await overview()
    readError = new ApiError('Unavailable', 'HTTP_ERROR', code)
    await act(async () => {
      await client.refetchQueries({ queryKey: detailKey() })
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This report is unavailable',
    )
    expect(screen.queryByText(report.title)).not.toBeInTheDocument()
  },
)

it('suppresses cached details when placement is lost, fails, or changes units', async () => {
  await show()
  await overview()
  unitError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await act(async () => {
    await client.refetchQueries({
      queryKey: residentUnitQueryOptions(resident.id).queryKey,
    })
  })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t confirm your unit',
  )
  expect(screen.queryByText(report.title)).not.toBeInTheDocument()
  unitError = undefined
  unit = null
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No unit assigned')
  unit = { ...report.unit, id: '11000000-0000-4000-8000-000000000009' }
  await act(async () => {
    await client.refetchQueries({
      queryKey: residentUnitQueryOptions(resident.id).queryKey,
    })
  })
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This report is unavailable',
    ),
  )
  expect(screen.queryByText(report.title)).not.toBeInTheDocument()
})

it('cancels pending reads on navigation and ignores a late response', async () => {
  let release!: () => void
  holdReport = new Promise((resolve) => {
    release = resolve
  })
  const { router } = await show()
  await waitFor(() => expect(detailRequests()).toHaveLength(1))
  await act(async () => {
    await router.navigate({ to: '/profile' })
  })
  expect(detailRequests()[0].signal?.aborted).toBe(true)
  await act(async () => release())
  expect(screen.queryByText(report.title)).not.toBeInTheDocument()
  expect(client.getQueryData(detailKey())).toBeUndefined()
})

it('cancels a pending detail read when placement is released', async () => {
  let release!: () => void
  holdReport = new Promise((resolve) => {
    release = resolve
  })
  await show()
  await waitFor(() => expect(detailRequests()).toHaveLength(1))
  await act(async () => {
    client.setQueryData(residentUnitQueryOptions(resident.id).queryKey, {
      unit: null,
    })
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('No unit assigned')
  expect(detailRequests()[0].signal?.aborted).toBe(true)
  await act(async () => release())
  expect(client.getQueryData(detailKey())).toBeUndefined()
})

it('does not reuse another resident’s cached details', async () => {
  client.setQueryData(
    residentReportDetailQueryOptions(
      'previous-resident',
      report.unit.id,
      report.id,
    ).queryKey,
    { ...report, title: 'Previous resident report' },
  )
  await show()
  await overview()
  expect(screen.queryByText('Previous resident report')).not.toBeInTheDocument()
  expect(detailRequests()).toHaveLength(1)
})

it('expires the session on a detail 401 and clears private details', async () => {
  await show()
  await overview()
  readError = new ApiError('Expired', 'UNAUTHORIZED', 401)
  await act(async () => {
    await client.refetchQueries({ queryKey: detailKey() })
  })
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(client.getQueryData(detailKey())).toBeUndefined()
  expect(screen.queryByText(report.title)).not.toBeInTheDocument()
})

it('blocks another role before making resident detail requests', async () => {
  await show(`/reports/${report.id}`, 'ADMIN')
  expect(
    await screen.findByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()
  expect(detailRequests()).toHaveLength(0)
})

it('rejects malformed detail data rather than rendering it', async () => {
  report.totalCost = 'invalid'
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t load this report',
  )
  expect(screen.queryByText(report.title)).not.toBeInTheDocument()
})
