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
import { expireSession, sessionKey } from '@/features/auth/auth-session'
import {
  technicianTaskListQueryOptions,
  technicianTasksQueryOptions,
} from '@/features/technician/technician-queries'
import type { Actor } from '@/features/auth/auth-schema'
import {
  report,
  reportDetail,
  completedReport,
  reportPage,
} from '../admin/reports/fixtures'
import { property } from '../admin/settings/fixtures'

const actor: Actor = {
  id: '33000000-0000-4000-8000-000000000004',
  name: 'Budi',
  loginIdentifier: 'budi',
  role: 'TECHNICIAN',
}
const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let total: number
let error: ApiError | undefined
let hold: Promise<void> | undefined
let requests: AxiosRequestConfig[]
let malformed: boolean

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  total = 21
  error = hold = undefined
  requests = []
  malformed = false
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = actor
    else if (config.url === '/property') data = property
    else if (config.url === '/reports') {
      const params = config.params as { status?: string; page: number }
      await hold
      if (error) throw error
      const records = Array.from(
        { length: Math.max(0, Math.min(10, total - (params.page - 1) * 10)) },
        (_, index) => ({
          ...report,
          id: `55000000-0000-4000-8000-${String(index + params.page * 10).padStart(12, '0')}`,
          title: `${params.status === 'CLOSED' ? 'History' : 'Ongoing'} ${params.page}-${index + 1}`,
          status:
            params.status === 'CLOSED'
              ? 'CLOSED'
              : (['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const)[index % 3],
        }),
      )
      data = malformed
        ? { data: [{ ...report, status: 'unknown' }], meta: {} }
        : reportPage(records, params.page, 10, total)
    } else if (config.url?.startsWith('/reports/'))
      data = {
        ...reportDetail,
        id: config.url.split('/').at(-1),
        status: 'CLOSED',
        assignment: { ...completedReport.assignment, technician: actor },
      }
    else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
  vi.unstubAllGlobals()
})
async function show(path = '/technician/tasks', who: Actor | null = actor) {
  client.setQueryData(sessionKey, who)
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
const listRequests = () => requests.filter((r) => r.url === '/reports')
const options = (view: 'ongoing' | 'history' = 'ongoing', page = 1) =>
  technicianTaskListQueryOptions(actor.id, { view, page })
function deferred() {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  return release
}

it('opens from navigation with homepage cards and an exact scoped request, without a placement read', async () => {
  const user = userEvent.setup()
  await show('/technician')
  await screen.findByRole('list', { name: 'Ongoing tasks' })
  await user.click(screen.getByRole('link', { name: 'Tasks' }))
  const list = await screen.findByRole('list', { name: 'Ongoing tasks' })
  expect(within(list).getAllByRole('link')).toHaveLength(10)
  for (const status of ['Assigned', 'In progress', 'Completed'])
    expect(within(list).getAllByText(status).length).toBeGreaterThan(0)
  expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
    'aria-current',
  )
  expect(listRequests().at(-1)).toMatchObject({
    method: 'get',
    params: { ongoingOnly: true, page: 1, pageSize: 10 },
    withCredentials: true,
  })
  expect(listRequests().at(-1)?.signal).toBeDefined()
  expect(requests.some((r) => r.url === '/resident/unit')).toBe(false)
})

it('uses centered minimal chevron pagination and keeps Completed ongoing', async () => {
  const user = userEvent.setup()
  const { router } = await show()
  await screen.findByText('Ongoing 1-1')
  const pagination = screen.getByRole('navigation', { name: 'Task pagination' })
  expect(within(pagination).getAllByRole('button')).toHaveLength(2)
  expect(within(pagination).getByLabelText('Current page 1')).toHaveTextContent(
    '1',
  )
  expect(pagination).not.toHaveTextContent(/of|tasks|showing|previous|next/i)
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Ongoing 2-1')
  expect(screen.getByRole('heading', { name: 'Tasks' })).toHaveFocus()
  expect(router.state.location.search).toEqual({ page: 2 })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Ongoing 3-1')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  await screen.findByText('Ongoing 2-1')
})

it('reads Closed history with server pagination and resets page on tab changes', async () => {
  const user = userEvent.setup()
  const { router } = await show('/technician/tasks?view=history&page=2')
  const list = await screen.findByRole('list', { name: 'Task history' })
  expect(within(list).getAllByText('Closed')).toHaveLength(10)
  expect(listRequests()).toHaveLength(1)
  expect(listRequests()[0]?.params).toEqual({
    status: 'CLOSED',
    page: 2,
    pageSize: 10,
  })
  await user.click(screen.getByRole('tab', { name: 'Ongoing' }))
  await screen.findByText('Ongoing 1-1')
  expect(router.state.location.search).toEqual({})
})

it('restores source view/page from details, supports browser Back, and resets on navigation', async () => {
  const user = userEvent.setup()
  const { router } = await show('/technician/tasks?view=history&page=2')
  await user.click(
    await screen.findByRole('link', { name: 'View task: History 2-1' }),
  )
  const back = await screen.findByRole('link', { name: 'Back to tasks' })
  expect(back).toHaveAttribute('href', '/technician/tasks?view=history&page=2')
  expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await user.click(back)
  await screen.findByText('History 2-1')
  await user.click(screen.getByRole('tab', { name: 'Ongoing' }))
  await screen.findByText('Ongoing 1-1')
  await act(() => router.history.back())
  await screen.findByText('History 2-1')
  await user.click(screen.getByRole('link', { name: 'Tasks' }))
  await screen.findByText('Ongoing 1-1')
  expect(router.state.location.search).toEqual({})
})

it.each([
  '?view=unknown&page=-1',
  '?page=1.5',
  '?page=Infinity',
  '?page=999999999999999999',
])('uses safe URL defaults for %s', async (search) => {
  await show('/technician/tasks' + search)
  await screen.findByText('Ongoing 1-1')
  expect(listRequests()[0]?.params).toEqual({
    ongoingOnly: true,
    page: 1,
    pageSize: 10,
  })
})

it('supports arrow/Home/End tab navigation and visible card keyboard focus', async () => {
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
  await user.keyboard('{End}{Tab}{Tab}')
  expect(
    screen.getByRole('link', { name: 'View task: History 1-1' }),
  ).toHaveFocus()
})

it.each(['ongoing', 'history'] as const)(
  'has a distinct empty state for %s without pagination',
  async (view) => {
    total = 0
    await show(`/technician/tasks?view=${view}`)
    await screen.findByRole('heading', {
      name: view === 'history' ? 'No task history' : 'No ongoing tasks',
    })
    expect(
      screen.queryByRole('navigation', { name: 'Task pagination' }),
    ).not.toBeInTheDocument()
  },
)

it('shows initial failure with one request, retries and retains matching data on refresh failure', async () => {
  const user = userEvent.setup()
  error = new ApiError('Failed', 'HTTP_ERROR', 503)
  await show()
  await screen.findByText('We couldn’t load your tasks.')
  expect(listRequests()).toHaveLength(1)
  error = undefined
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Ongoing 1-1')
  error = new ApiError('Failed', 'HTTP_ERROR', 503)
  await act(() => client.invalidateQueries({ queryKey: options().queryKey }))
  await screen.findByText(/Showing the last available information/)
  expect(screen.getByText('Ongoing 1-1')).toBeVisible()
  await user.click(screen.getByRole('tab', { name: 'History' }))
  await screen.findByText('We couldn’t load your tasks.')
  expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
})

it.each([403, 404])(
  'hides cached data on %i and recovers through Retry',
  async (status) => {
    const user = userEvent.setup()
    await show()
    await screen.findByText('Ongoing 1-1')
    error = new ApiError('Unavailable', 'HTTP_ERROR', status)
    await act(() => client.invalidateQueries({ queryKey: options().queryKey }))
    await screen.findByText(/Your tasks are unavailable/)
    expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
    error = undefined
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Ongoing 1-1')
  },
)

it('validates malformed responses without rendering unsafe cards', async () => {
  malformed = true
  await show()
  await screen.findByText('We couldn’t load your tasks.')
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(listRequests()).toHaveLength(1)
})

it('shows a skeleton on uncached pages and cancels obsolete view requests', async () => {
  const user = userEvent.setup()
  await show()
  await screen.findByText('Ongoing 1-1')
  const release = deferred()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByRole('status', { name: 'Loading tasks' })
  expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
  const pending = listRequests().at(-1)!
  await user.click(screen.getByRole('tab', { name: 'History' }))
  await waitFor(() => expect(pending.signal?.aborted).toBe(true))
  await act(() => {
    hold = undefined
    release()
  })
  await screen.findByText('History 1-1')
  expect(screen.queryByText('Ongoing 2-1')).not.toBeInTheDocument()
})

it('isolates actors, cancels their pending reads and prevents late cached results', async () => {
  await show()
  await screen.findByText('Ongoing 1-1')
  const release = deferred()
  void client.invalidateQueries({ queryKey: options().queryKey })
  await waitFor(() => expect(listRequests()).toHaveLength(2))
  const pending = listRequests().at(-1)!
  total = 0
  await act(() => {
    client.setQueryData(sessionKey, {
      ...actor,
      id: '33000000-0000-4000-8000-000000000005',
    })
  })
  await screen.findByRole('status', { name: 'Loading tasks' })
  expect(pending.signal?.aborted).toBe(true)
  expect(screen.queryByText('Ongoing 1-1')).not.toBeInTheDocument()
  await act(() => {
    hold = undefined
    release()
  })
  await screen.findByRole('heading', { name: 'No ongoing tasks' })
})

it('corrects out-of-range pages using replace and handles a newly empty list', async () => {
  const { router } = await show('/technician/tasks?view=history&page=9')
  await screen.findByText('History 3-1')
  expect(router.state.location.search).toEqual({ view: 'history', page: 3 })
  expect(router.history.length).toBe(1)
  total = 0
  await act(() =>
    client.invalidateQueries({ queryKey: options('history', 3).queryKey }),
  )
  await screen.findByRole('heading', { name: 'No task history' })
  expect(router.state.location.search).toEqual({ view: 'history' })
})

it('invalidates every view/page through the existing mutation/home task prefix', async () => {
  for (const view of ['ongoing', 'history'] as const)
    for (const page of [1, 2])
      client.setQueryData(
        options(view, page).queryKey,
        reportPage([], page, 10),
      )
  await client.invalidateQueries({
    queryKey: technicianTasksQueryOptions(actor.id).queryKey,
  })
  for (const view of ['ongoing', 'history'] as const)
    for (const page of [1, 2])
      expect(
        client.getQueryState(options(view, page).queryKey)?.isInvalidated,
      ).toBe(true)
  expect(options()).toMatchObject({
    staleTime: 60_000,
    retry: false,
    meta: { requiresAuth: true },
  })
  expect(
    technicianTaskListQueryOptions('other', { view: 'ongoing', page: 1 })
      .queryKey,
  ).not.toEqual(options().queryKey)
})

it('expires sessions after 401 and clears all technician list caches', async () => {
  await show()
  await screen.findByText('Ongoing 1-1')
  error = new ApiError('Expired', 'UNAUTHORIZED', 401)
  await act(() => client.invalidateQueries({ queryKey: options().queryKey }))
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(
    client
      .getQueriesData({ queryKey: ['technician'] })
      .every(([, data]) => data === undefined),
  ).toBe(true)
})

it('cancels pending reads on unmount and ignores responses after expiration', async () => {
  const release = deferred()
  const view = await show()
  await screen.findByRole('status', { name: 'Loading tasks' })
  const pending = listRequests()[0]!
  await act(() => expireSession(client))
  expect(pending.signal?.aborted).toBe(true)
  view.unmount()
  await act(() => release())
  expect(client.getQueryData(options().queryKey)).toBeUndefined()
})

it.each(['ADMIN', 'RESIDENT'] as const)(
  'blocks %s from Tasks',
  async (role) => {
    await show('/technician/tasks', { ...actor, role })
    await screen.findByRole('heading', { name: 'Access denied' })
    expect(listRequests()).toHaveLength(0)
  },
)
it('redirects guests while preserving a direct history destination', async () => {
  const { router } = await show('/technician/tasks?view=history&page=2', null)
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(router.state.location.search).toMatchObject({
    redirect: '/technician/tasks?view=history&page=2',
  })
  expect(listRequests()).toHaveLength(0)
})
