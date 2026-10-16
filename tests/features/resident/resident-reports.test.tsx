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
import {
  residentReportListQueryOptions,
  residentReportsKey,
  residentUnitQueryOptions,
} from '@/features/resident/resident-queries'
import { report, reportDetail, reportPage } from '../admin/reports/fixtures'
import { property } from '../admin/settings/fixtures'

const actor = {
  id: '33000000-0000-4000-8000-000000000003',
  name: 'Maya',
  loginIdentifier: 'maya',
  role: 'RESIDENT' as const,
}
const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let unit: typeof report.unit | null
let total: number
let listError: ApiError | undefined
let unitError: ApiError | undefined
let hold: Promise<void> | undefined
let holdUnit: Promise<void> | undefined
let requests: AxiosRequestConfig[]

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  unit = { ...report.unit }
  total = 21
  listError = unitError = undefined
  hold = holdUnit = undefined
  requests = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = actor
    else if (config.url === '/resident/unit') {
      await holdUnit
      if (unitError) throw unitError
      data = { unit }
    } else if (config.url === '/property') data = property
    else if (config.url === '/reports') {
      const params = config.params as { historyOnly?: boolean; page: number }
      await hold
      if (listError) throw listError
      const records = Array.from(
        { length: Math.max(0, Math.min(10, total - (params.page - 1) * 10)) },
        (_, index) => ({
          ...report,
          id: `55000000-0000-4000-8000-${String(index + params.page * 10).padStart(12, '0')}`,
          title: `${params.historyOnly ? 'History' : 'Ongoing'} ${params.page}-${index + 1}`,
          unit: unit ?? report.unit,
          status: params.historyOnly
            ? index % 2
              ? 'REJECTED'
              : 'CLOSED'
            : index % 2
              ? 'COMPLETED'
              : 'REPORTED',
        }),
      )
      data = reportPage(records, params.page, 10, total)
    } else if (config.url?.startsWith('/reports/'))
      data = { ...reportDetail, id: config.url.split('/').at(-1) }
    else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})

async function show(path = '/reports') {
  client.setQueryData(sessionKey, actor)
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
const listRequests = () =>
  requests.filter((request) => request.url === '/reports')
const key = (view: 'ongoing' | 'history' = 'ongoing', page = 1) =>
  residentReportListQueryOptions(actor.id, report.unit.id, { view, page })
    .queryKey

it('opens from navigation with homepage cards, exact ongoing payload and minimal pagination', async () => {
  const user = userEvent.setup()
  await show('/')
  await screen.findByRole('list', { name: 'Ongoing reports' })
  await user.click(screen.getByRole('link', { name: 'Reports' }))
  const list = await screen.findByRole('list', { name: 'Ongoing reports' })
  expect(within(list).getAllByRole('link')).toHaveLength(10)
  expect(within(list).getAllByText('Completed')).toHaveLength(5)
  expect(screen.getByText('Unit B-202 · Floor 2')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const pagination = screen.getByRole('navigation', {
    name: 'Report pagination',
  })
  expect(within(pagination).getAllByRole('button')).toHaveLength(2)
  expect(
    within(pagination).getByRole('button', { name: 'Previous' }),
  ).toBeDisabled()
  expect(within(pagination).getByRole('button', { name: 'Next' })).toBeEnabled()
  expect(within(pagination).getByLabelText('Current page 1')).toHaveTextContent(
    '1',
  )
  expect(pagination).not.toHaveTextContent(/of|reports|showing/i)
  expect(listRequests().at(-1)).toMatchObject({
    params: { ongoingOnly: true, page: 1, pageSize: 10 },
    withCredentials: true,
  })
  expect(listRequests().at(-1)?.signal).toBeDefined()
})

it('reads a direct history page as one server-filtered request, supports previous/next and tab reset', async () => {
  const user = userEvent.setup()
  const { router } = await show('/reports?view=history&page=2')
  const list = await screen.findByRole('list', { name: 'Report history' })
  expect(within(list).getByText('History 2-1')).toBeVisible()
  expect(within(list).getAllByText('Closed')).toHaveLength(5)
  expect(within(list).getAllByText('Rejected')).toHaveLength(5)
  expect(listRequests()).toHaveLength(1)
  expect(listRequests()[0]?.params).toEqual({
    historyOnly: true,
    page: 2,
    pageSize: 10,
  })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('History 3-1')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(screen.getByRole('heading', { name: 'Reports' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  await screen.findByText('History 2-1')
  await user.click(screen.getByRole('tab', { name: 'Ongoing' }))
  await screen.findByText('Ongoing 1-1')
  expect(router.state.location.search).toEqual({})
})

it('returns from details and browser Back to the source view/page; navigation resets to ongoing', async () => {
  const user = userEvent.setup()
  const { router } = await show('/reports?view=history&page=2')
  const card = await screen.findByRole('link', {
    name: 'View report: History 2-1',
  })
  await user.click(card)
  const back = await screen.findByRole('link', { name: 'Back to reports' })
  expect(back).toHaveAttribute('href', '/reports?view=history&page=2')
  await user.click(back)
  await screen.findByText('History 2-1')
  await user.click(screen.getByRole('tab', { name: 'Ongoing' }))
  await screen.findByText('Ongoing 1-1')
  await act(async () => {
    router.history.back()
  })
  await screen.findByText('History 2-1')
  await user.click(screen.getByRole('link', { name: 'Reports' }))
  await screen.findByText('Ongoing 1-1')
  expect(router.state.location.search).toEqual({})
})

it.each([
  '?view=unknown&page=-1',
  '?page=1.5',
  '?page=Infinity',
  '?page=999999999999999999',
])('uses safe URL defaults for %s', async (search) => {
  await show(`/reports${search}`)
  await screen.findByText('Ongoing 1-1')
  expect(listRequests()[0]?.params).toEqual({
    ongoingOnly: true,
    page: 1,
    pageSize: 10,
  })
})

it('supports arrow/Home/End tab keyboard navigation', async () => {
  const user = userEvent.setup()
  await show()
  await screen.findByText('Ongoing 1-1')
  screen.getByRole('tab', { name: 'Ongoing' }).focus()
  await user.keyboard('{ArrowRight}')
  await screen.findByText('History 1-1')
  expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus()
  await user.keyboard('{Home}')
  await screen.findByText('Ongoing 1-1')
  expect(screen.getByRole('tab', { name: 'Ongoing' })).toHaveFocus()
  await user.keyboard('{End}')
  await screen.findByText('History 1-1')
})

it('waits for confirmed placement, and never reads reports without an assignment', async () => {
  let release!: () => void
  holdUnit = new Promise((resolve) => {
    release = resolve
  })
  unit = null
  await show()
  expect(screen.getByRole('status', { name: 'Loading unit' })).toBeVisible()
  expect(listRequests()).toHaveLength(0)
  await act(async () => {
    release()
  })
  await screen.findByText(/No unit assigned/)
  expect(listRequests()).toHaveLength(0)
  expect(
    screen.queryByRole('button', { name: 'Report' }),
  ).not.toBeInTheDocument()
})

it('retries a failed placement read before requesting reports', async () => {
  const user = userEvent.setup()
  unitError = new ApiError('Failed', 'HTTP_ERROR', 503)
  await show()
  await screen.findByText(/couldn’t confirm your unit/)
  expect(listRequests()).toHaveLength(0)
  unitError = undefined
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Ongoing 1-1')
})

it('shows skeletons on uncached page changes and cancels obsolete reads', async () => {
  const user = userEvent.setup()
  await show()
  await screen.findByText('Ongoing 1-1')
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByRole('status', { name: 'Loading reports' })
  expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
  const pending = listRequests().at(-1)!
  await user.click(screen.getByRole('tab', { name: 'History' }))
  await waitFor(() => expect(pending.signal?.aborted).toBe(true))
  await act(async () => {
    hold = undefined
    release()
  })
  await screen.findByText('History 1-1')
  expect(screen.queryByText('Ongoing 2-1')).not.toBeInTheDocument()
})

it.each(['ongoing', 'history'] as const)(
  'shows the distinct successful empty state for %s',
  async (view) => {
    total = 0
    await show(`/reports?view=${view}`)
    await screen.findByRole('heading', {
      name: view === 'history' ? 'No report history' : 'No ongoing reports',
    })
    expect(
      screen.queryByRole('navigation', { name: 'Report pagination' }),
    ).not.toBeInTheDocument()
  },
)

it('does not automatically retry errors and retains matching records on refresh failure', async () => {
  const user = userEvent.setup()
  listError = new ApiError('Failed', 'HTTP_ERROR', 503)
  await show()
  await screen.findByText('We couldn’t load your reports.')
  expect(listRequests()).toHaveLength(1)
  listError = undefined
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Ongoing 1-1')
  listError = new ApiError('Failed', 'HTTP_ERROR', 503)
  await act(() => client.invalidateQueries({ queryKey: key() }))
  await screen.findByText(/Showing the last available information/)
  expect(screen.getByText('Ongoing 1-1')).toBeVisible()
  await user.click(screen.getByRole('tab', { name: 'History' }))
  await screen.findByText('We couldn’t load your reports.')
  expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
})

it.each([403, 404])(
  'hides cached records on %s and refreshes placement',
  async (status) => {
    await show()
    await screen.findByText('Ongoing 1-1')
    const count = requests.filter(
      (request) => request.url === '/resident/unit',
    ).length
    listError = new ApiError('Unavailable', 'HTTP_ERROR', status)
    await act(() => client.invalidateQueries({ queryKey: key() }))
    await screen.findByText(/Your reports are unavailable/)
    expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        requests.filter((request) => request.url === '/resident/unit').length,
      ).toBeGreaterThan(count),
    )
  },
)

it('suppresses reports on placement refresh failure or release and cancels pending work', async () => {
  await show()
  await screen.findByText('Ongoing 1-1')
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  void client.invalidateQueries({ queryKey: key() })
  await waitFor(() => expect(listRequests()).toHaveLength(2))
  const pending = listRequests().at(-1)!
  unitError = new ApiError('Failed', 'HTTP_ERROR', 503)
  await act(() =>
    client.invalidateQueries({
      queryKey: residentUnitQueryOptions(actor.id).queryKey,
    }),
  )
  await screen.findByText(/couldn’t confirm your unit/)
  expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
  expect(pending.signal?.aborted).toBe(true)
  await act(async () => {
    hold = undefined
    release()
  })
  unitError = undefined
  unit = null
  await act(() =>
    client.invalidateQueries({
      queryKey: residentUnitQueryOptions(actor.id).queryKey,
    }),
  )
  await screen.findByText(/No unit assigned/)
})

it('isolates caches when current placement changes', async () => {
  await show()
  await screen.findByText('Ongoing 1-1')
  unit = {
    ...report.unit,
    id: '11000000-0000-4000-8000-000000000003',
    unitNumber: 'C-303',
  }
  await act(() =>
    client.invalidateQueries({
      queryKey: residentUnitQueryOptions(actor.id).queryKey,
    }),
  )
  await screen.findByText('Unit C-303 · Floor 2')
  await waitFor(() => expect(listRequests()).toHaveLength(2))
  expect(
    client.getQueryData(
      residentReportListQueryOptions(actor.id, unit.id, {
        view: 'ongoing',
        page: 1,
      }).queryKey,
    ),
  ).toBeDefined()
})

it('corrects an out-of-range page with replace navigation and handles an empty result', async () => {
  const { router } = await show('/reports?view=history&page=9')
  await screen.findByText('History 3-1')
  expect(router.state.location.search).toEqual({ view: 'history', page: 3 })
  expect(router.history.length).toBe(1)
  total = 0
  await act(() => client.invalidateQueries({ queryKey: key('history', 3) }))
  await screen.findByRole('heading', { name: 'No report history' })
  expect(router.state.location.search).toEqual({ view: 'history' })
})

it('expires sessions and clears private caches after a list 401', async () => {
  await show()
  await screen.findByText('Ongoing 1-1')
  listError = new ApiError('Expired', 'UNAUTHORIZED', 401)
  await act(() => client.invalidateQueries({ queryKey: key() }))
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(
    client
      .getQueriesData({ queryKey: residentReportsKey })
      .every(([, data]) => data === undefined),
  ).toBe(true)
})

it('uses actor/unit/view/page keys, authenticated metadata and disabled retries', () => {
  const options = residentReportListQueryOptions(actor.id, report.unit.id, {
    view: 'history',
    page: 2,
  })
  expect(options).toMatchObject({
    staleTime: 60_000,
    retry: false,
    meta: { requiresAuth: true },
  })
  expect(options.queryKey).not.toEqual(
    residentReportListQueryOptions('another', report.unit.id, {
      view: 'history',
      page: 2,
    }).queryKey,
  )
  expect(options.queryKey).not.toEqual(key('history', 1))
  expect(options.queryKey).not.toEqual(key('ongoing', 2))
})

it('hides a response for another unit and checks placement again', async () => {
  await show()
  await screen.findByText('Ongoing 1-1')
  await act(async () => {
    client.setQueryData(
      key(),
      reportPage(
        [
          {
            ...report,
            unit: {
              ...report.unit,
              id: '11000000-0000-4000-8000-000000000003',
            },
          },
        ],
        1,
        10,
      ),
    )
  })
  await screen.findByText(/Your reports are unavailable/)
  expect(
    screen.queryByRole('list', { name: 'Ongoing reports' }),
  ).not.toBeInTheDocument()
})

it('cancels a pending list read when leaving Reports', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  const { router } = await show()
  await screen.findByRole('status', { name: 'Loading reports' })
  const pending = listRequests()[0]!
  await act(() => router.navigate({ to: '/profile' }))
  await screen.findByRole('heading', { name: 'Your profile' })
  expect(pending.signal?.aborted).toBe(true)
  await act(async () => {
    release()
  })
  expect(client.getQueryData(key())).toBeUndefined()
})

it('keeps the shared creation sheet available through the navigation plus', async () => {
  const user = userEvent.setup()
  await show('/reports?view=history')
  await screen.findByText('History 1-1')
  await user.click(screen.getByRole('button', { name: 'Report' }))
  await screen.findByRole('dialog', { name: 'Report a problem' })
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Report' })).toHaveFocus()
})
