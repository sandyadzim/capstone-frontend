// @vitest-environment jsdom
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
import type { InternalAxiosRequestConfig } from 'axios'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { routeTree } from '@/routeTree.gen'
import { sessionKey } from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'
import {
  technicianPropertyQueryOptions,
  technicianTasksQueryOptions,
} from '@/features/technician/technician-queries'
import { useThemeStore } from '@/stores/theme-store'
import { toast } from '@/components/ui/toast'
import { report, reportPage } from '../admin/reports/fixtures'
import { property as sampleProperty } from '../admin/settings/fixtures'

const technician: Actor = {
  id: '33000000-0000-4000-8000-000000000004',
  name: 'Budi Santoso',
  loginIdentifier: 'budi.santoso',
  role: 'TECHNICIAN',
}
const assignedReport = {
  ...report,
  status: 'ASSIGNED' as const,
  finalPriority: 'HIGH' as const,
}
const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: InternalAxiosRequestConfig[]
let reports: unknown
let property: typeof sampleProperty
let reportsError: ApiError | undefined
let propertyError: ApiError | undefined
let logoutError: ApiError | undefined
let holdReports: Promise<void> | undefined
let holdProperty: Promise<void> | undefined
let holdLogout: Promise<void> | undefined
let expired: boolean

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  requests = []
  reports = reportPage([assignedReport], 1, 10)
  property = { ...sampleProperty }
  reportsError = propertyError = logoutError = undefined
  holdReports = holdProperty = holdLogout = undefined
  expired = false
  useThemeStore.setState({ theme: 'system' })
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') {
      if (expired) throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
      data = technician
    } else if (config.url === '/property') {
      await holdProperty
      if (propertyError) throw propertyError
      data = property
    } else if (config.url === '/reports') {
      await holdReports
      if (reportsError) throw reportsError
      data = reports
    } else if (config.url === '/auth/logout') {
      await holdLogout
      if (logoutError) throw logoutError
      expired = true
      return {
        data: null,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config,
      }
    } else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  toast.close()
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})
async function show(path = '/technician', actor: Actor | null = technician) {
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
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
function taskRequests() {
  return requests.filter((request) => request.url === '/reports')
}

it('shows the Concierge home and real property, then opens profile within the technician portal', async () => {
  const user = userEvent.setup()
  const { router } = await show()
  expect(
    await screen.findByRole('heading', { name: /Welcome back,\s*Budi/ }),
  ).toBeVisible()
  expect(
    await screen.findByRole('link', {
      name: `${property.name} · Technician home`,
    }),
  ).toBeVisible()
  const nav = screen.getByRole('navigation', { name: 'Technician navigation' })
  expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(within(nav).getByRole('button', { name: 'Tasks' })).toBeDisabled()
  expect(
    screen.queryByRole('link', { name: 'Example form' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Starter preview')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Check API connection' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('link', { name: `Open profile for ${technician.name}` }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Your profile' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/technician/profile')
  expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute(
    'aria-current',
  )
  await user.click(screen.getByRole('link', { name: 'Back to home' }))
  expect(
    await screen.findByRole('heading', { name: 'Your ongoing tasks' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/technician')
})

it('sends the exact credentialed cancellable ongoing request and needs no resident placement read', async () => {
  await show()
  await screen.findByRole('list', { name: 'Ongoing tasks' })
  expect(taskRequests()).toHaveLength(1)
  expect(taskRequests()[0]).toMatchObject({
    method: 'get',
    params: { ongoingOnly: true, page: 1, pageSize: 10 },
    withCredentials: true,
  })
  expect(taskRequests()[0].signal).toBeInstanceOf(AbortSignal)
  expect(
    requests.filter((request) => request.url === '/resident/unit'),
  ).toHaveLength(0)
  const options = technicianTasksQueryOptions(technician.id)
  expect(options).toMatchObject({
    queryKey: ['technician', 'tasks', technician.id],
    staleTime: 60_000,
    retry: false,
    meta: { requiresAuth: true },
  })
})

it('shows categories, unit/floor, actual statuses, Jakarta dates and priority fallback on read-only summaries', async () => {
  reports = reportPage(
    [
      assignedReport,
      {
        ...assignedReport,
        id: '55000000-0000-4000-8000-000000000002',
        title: 'Kitchen sink leak',
        status: 'IN_PROGRESS',
        category: 'PLUMBING',
        finalPriority: null,
      },
      {
        ...assignedReport,
        id: '55000000-0000-4000-8000-000000000003',
        title: 'Wardrobe repaired',
        status: 'COMPLETED',
        category: 'FURNITURE',
        finalPriority: null,
        proposedPriority: null,
      },
    ],
    1,
    10,
  )
  await show()
  const list = await screen.findByRole('list', { name: 'Ongoing tasks' })
  const items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(within(items[0]).getByText('High')).toBeVisible()
  expect(within(items[1]).getByText('Medium')).toBeVisible()
  expect(within(items[2]).getByText('—')).toBeVisible()
  for (const status of ['Assigned', 'In progress', 'Completed'])
    expect(
      within(list).getByText(status, {
        exact: false,
        selector: 'span.font-semibold',
      }),
    ).toBeVisible()
  expect(items[0]).toHaveTextContent('Unit B-202')
  expect(items[0]).toHaveTextContent('Floor 2')
  expect(within(items[0]).getByText('2 Oct 2026, 01:30')).toHaveAttribute(
    'dateTime',
    report.reportedAt,
  )
  expect(within(list).queryByRole('link')).not.toBeInTheDocument()
  expect(within(list).queryByRole('button')).not.toBeInTheDocument()
})

it('limits the homepage to ten records and explains the latest-ten limit', async () => {
  reports = reportPage(
    Array.from({ length: 10 }, (_, index) => ({
      ...assignedReport,
      id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    })),
    1,
    10,
    23,
  )
  await show()
  expect(
    within(
      await screen.findByRole('list', { name: 'Ongoing tasks' }),
    ).getAllByRole('listitem'),
  ).toHaveLength(10)
  expect(screen.getByText('Showing the latest 10 ongoing tasks.')).toBeVisible()
  expect(
    screen.queryByRole('navigation', { name: /pagination/i }),
  ).not.toBeInTheDocument()
})

it('shows an empty state only after a successful empty response', async () => {
  reports = reportPage([], 1, 10)
  await show()
  expect(
    await screen.findByRole('heading', { name: 'No ongoing tasks' }),
  ).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('loads tasks independently while property branding waits', async () => {
  const pending = deferred()
  holdProperty = pending.promise
  await show()
  expect(await screen.findByText(assignedReport.title)).toBeVisible()
  expect(
    screen.queryByRole('link', { name: /Technician home/ }),
  ).not.toBeInTheDocument()
  await act(() => pending.release())
  expect(
    await screen.findByRole('link', {
      name: `${property.name} · Technician home`,
    }),
  ).toBeVisible()
})

it('shows skeletons while tasks load without displaying an empty state', async () => {
  const pending = deferred()
  holdReports = pending.promise
  await show()
  expect(
    await screen.findByRole('status', { name: 'Loading ongoing tasks' }),
  ).toBeVisible()
  expect(screen.queryByText('No ongoing tasks')).not.toBeInTheDocument()
  await act(() => pending.release())
  expect(await screen.findByText(assignedReport.title)).toBeVisible()
})

it('shows a load error with explicit retry and no automatic retries', async () => {
  reportsError = new ApiError('Offline', 'NETWORK_ERROR')
  const user = userEvent.setup()
  await show()
  expect(
    await screen.findByText('We couldn’t load your ongoing tasks.'),
  ).toBeVisible()
  expect(screen.queryByText('No ongoing tasks')).not.toBeInTheDocument()
  expect(taskRequests()).toHaveLength(1)
  reportsError = undefined
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText(assignedReport.title)).toBeVisible()
  expect(taskRequests()).toHaveLength(2)
})

it('retains matching tasks when an ordinary background refresh fails', async () => {
  await show()
  await screen.findByText(assignedReport.title)
  reportsError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await act(() =>
    client.refetchQueries({
      queryKey: technicianTasksQueryOptions(technician.id).queryKey,
    }),
  )
  expect(screen.getByText(assignedReport.title)).toBeVisible()
  expect(
    await screen.findByText('We couldn’t refresh your ongoing tasks.'),
  ).toBeVisible()
})

it.each([403, 404])(
  'hides cached summaries after access failure %s',
  async (status) => {
    await show()
    await screen.findByText(assignedReport.title)
    reportsError = new ApiError('Unavailable', 'HTTP_ERROR', status)
    await act(() =>
      client.refetchQueries({
        queryKey: technicianTasksQueryOptions(technician.id).queryKey,
      }),
    )
    expect(await screen.findByText(/Your tasks are unavailable/)).toBeVisible()
    expect(screen.queryByText(assignedReport.title)).not.toBeInTheDocument()
    expect(client.getQueryData(sessionKey)).toEqual(technician)
  },
)

it('rejects malformed task responses at the existing runtime boundary', async () => {
  reports = {
    data: [{ ...assignedReport, status: 'STARTED' }],
    meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
  }
  await show()
  expect(
    await screen.findByText('We couldn’t load your ongoing tasks.'),
  ).toBeVisible()
  expect(
    screen.queryByRole('list', { name: 'Ongoing tasks' }),
  ).not.toBeInTheDocument()
})

it('supports direct profile links without reading tasks or resident units', async () => {
  await show('/technician/profile')
  expect(
    await screen.findByRole('heading', { name: 'Your profile' }),
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Your account' })).getByText(
      technician.loginIdentifier,
    ),
  ).toBeVisible()
  const propertySection = screen.getByRole('region', { name: 'Property' })
  expect(
    await within(propertySection).findByText(property.address),
  ).toBeVisible()
  expect(taskRequests()).toHaveLength(0)
  expect(
    requests.some(
      (request) =>
        request.url === '/resident/unit' || request.url?.includes('/accounts'),
    ),
  ).toBe(false)
})

it('keeps account details available while property loads and after property failure', async () => {
  const pending = deferred()
  holdProperty = pending.promise
  await show('/technician/profile')
  expect(await screen.findByText(technician.loginIdentifier)).toBeVisible()
  expect(
    screen.getByRole('status', { name: 'Loading property information' }),
  ).toBeVisible()
  propertyError = new ApiError('Offline', 'NETWORK_ERROR')
  await act(() => pending.release())
  expect(
    await screen.findByText('We couldn’t load the property information.'),
  ).toBeVisible()
  expect(screen.getByText(technician.loginIdentifier)).toBeVisible()
})

it('retains property details during a refresh error and recovers with retry', async () => {
  const user = userEvent.setup()
  await show('/technician/profile')
  await screen.findByText(property.address)
  propertyError = new ApiError('Offline', 'NETWORK_ERROR')
  await act(() =>
    client.refetchQueries({
      queryKey: technicianPropertyQueryOptions(technician.id).queryKey,
    }),
  )
  expect(screen.getByText(property.address)).toBeVisible()
  expect(
    await screen.findByText('We couldn’t refresh the property information.'),
  ).toBeVisible()
  propertyError = undefined
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  )
})

it('falls back to the real property name when a saved logo fails', async () => {
  property.logoUrl = 'https://example.test/property.png'
  await show()
  const image = await screen.findByRole('img', { name: property.name })
  fireEvent.error(image)
  expect(
    screen.getByRole('link', { name: `${property.name} · Technician home` }),
  ).toHaveTextContent(property.name)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('uses Property fallback and retry without blocking tasks when the property read fails', async () => {
  propertyError = new ApiError('Offline', 'NETWORK_ERROR')
  await show()
  expect(
    await screen.findByText('We couldn’t load the property information.'),
  ).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Property · Technician home' }),
  ).toBeVisible()
  expect(await screen.findByText(assignedReport.title)).toBeVisible()
})

it('uses persisted appearance controls without a profile write', async () => {
  const user = userEvent.setup()
  await show('/technician/profile')
  for (const value of ['Dark', 'Light', 'System']) {
    await user.click(screen.getByRole('button', { name: value }))
    expect(screen.getByRole('button', { name: value })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(useThemeStore.getState().theme).toBe(value.toLowerCase())
  }
  expect(requests.every((request) => request.method === 'get')).toBe(true)
})

it('signs out once, blocks duplicates while pending and clears private data on confirmation', async () => {
  const pending = deferred()
  holdLogout = pending.promise
  const user = userEvent.setup()
  const { router } = await show('/technician/profile')
  await client.fetchQuery(technicianTasksQueryOptions(technician.id))
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled()
  expect(
    requests.filter((request) => request.url === '/auth/logout'),
  ).toHaveLength(1)
  await act(() => pending.release())
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(router.state.location.pathname).toBe('/login')
  expect(
    client.getQueryData(technicianTasksQueryOptions(technician.id).queryKey),
  ).toBeUndefined()
})

it('retains the session and profile when sign out fails', async () => {
  logoutError = new ApiError('Offline', 'NETWORK_ERROR')
  const user = userEvent.setup()
  await show('/technician/profile')
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(
    await screen.findByText(
      'Unable to sign out. Check your connection and try again.',
      { selector: '[data-slot=toast-description]' },
    ),
  ).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Your profile' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  expect(client.getQueryData(sessionKey)).toEqual(technician)
})

it('expires a session on private 401 and removes matching cached tasks', async () => {
  await show()
  await screen.findByText(assignedReport.title)
  expired = true
  reportsError = new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
  await act(() =>
    client.refetchQueries({
      queryKey: technicianTasksQueryOptions(technician.id).queryKey,
    }),
  )
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(screen.queryByText(assignedReport.title)).not.toBeInTheDocument()
  expect(
    client.getQueryData(technicianTasksQueryOptions(technician.id).queryKey),
  ).toBeUndefined()
})

it('cancels a pending task read when leaving home for profile', async () => {
  const pending = deferred()
  holdReports = pending.promise
  const user = userEvent.setup()
  await show()
  await screen.findByRole('status', { name: 'Loading ongoing tasks' })
  const signal = taskRequests()[0].signal
  await user.click(
    screen.getByRole('link', { name: `Open profile for ${technician.name}` }),
  )
  await screen.findByRole('heading', { name: 'Your profile' })
  expect(signal?.aborted).toBe(true)
  await act(() => pending.release())
  expect(screen.queryByText(assignedReport.title)).not.toBeInTheDocument()
})

it('cancels pending property and task reads on unmount', async () => {
  const pending = deferred()
  holdReports = holdProperty = pending.promise
  const view = await show()
  await screen.findByRole('status', { name: 'Loading ongoing tasks' })
  const pendingRequests = requests.filter(
    (request) => request.url === '/reports' || request.url === '/property',
  )
  view.unmount()
  expect(pendingRequests).toHaveLength(2)
  expect(pendingRequests.every((request) => request.signal?.aborted)).toBe(true)
  await act(() => pending.release())
})

it('hides the previous technician’s cached tasks when the actor changes', async () => {
  await show()
  await screen.findByText(assignedReport.title)
  const pending = deferred()
  holdReports = pending.promise
  const other = {
    ...technician,
    id: '33000000-0000-4000-8000-000000000005',
    name: 'Dewi Putri',
  }
  await act(() => {
    client.setQueryData(sessionKey, other)
  })
  expect(
    await screen.findByRole('status', { name: 'Loading ongoing tasks' }),
  ).toBeVisible()
  expect(screen.queryByText(assignedReport.title)).not.toBeInTheDocument()
  expect(taskRequests()).toHaveLength(2)
  reports = reportPage([], 1, 10)
  await act(() => pending.release())
  expect(await screen.findByText('No ongoing tasks')).toBeVisible()
  expect(
    screen.getByRole('link', { name: `Open profile for ${other.name}` }),
  ).toBeVisible()
})

it.each(['ADMIN', 'RESIDENT'] as const)(
  'blocks %s from direct technician profile access',
  async (role) => {
    await show('/technician/profile', { ...technician, role })
    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeVisible()
    expect(requests).toHaveLength(0)
  },
)

it('redirects guests to login with the direct profile destination', async () => {
  const { router } = await show('/technician/profile', null)
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(router.state.location.search).toMatchObject({
    redirect: '/technician/profile',
  })
  expect(taskRequests()).toHaveLength(0)
})
