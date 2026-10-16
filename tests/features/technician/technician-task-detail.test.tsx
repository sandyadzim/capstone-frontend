// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { InternalAxiosRequestConfig } from 'axios'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { expireSession, sessionKey } from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'
import {
  technicianTaskDetailQueryOptions,
  technicianTasksQueryOptions,
} from '@/features/technician/technician-queries'
import {
  startWorkFormSchema,
  startWorkPayload,
} from '@/features/technician/start-work-schema'
import { startTask } from '@/features/technician/technician-task-api'
import { toast } from '@/components/ui/toast'
import {
  completedReport,
  reportDetail,
  reportPage,
  photo,
} from '../admin/reports/fixtures'
import { property } from '../admin/settings/fixtures'
import type { ReportDetail } from '@/features/admin/reports/report-schema'

const technician: Actor = {
  id: '33000000-0000-4000-8000-000000000004',
  name: 'Budi Santoso',
  loginIdentifier: 'budi',
  role: 'TECHNICIAN',
}
const path = `/technician/tasks/${reportDetail.id}`
const originalScroll = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
)
const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: InternalAxiosRequestConfig[]
let detail: ReportDetail
let getError: ApiError | undefined
let startError: ApiError | undefined
let holdGet: Promise<void> | undefined
let holdPost: Promise<void> | undefined
let expired: boolean
let commitBeforeError: boolean

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  vi.setSystemTime(new Date('2026-10-16T03:00:00Z'))
  client = createQueryClient()
  requests = []
  detail = {
    ...reportDetail,
    status: 'ASSIGNED',
    assignment: {
      id: '66000000-0000-4000-8000-000000000001',
      technician,
      assignedAt: reportDetail.reportedAt,
      estimatedArrivalAt: null,
      note: 'Bring a drain-cleaning kit.',
    },
  }
  getError = startError = undefined
  holdGet = holdPost = undefined
  expired = commitBeforeError = false
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') {
      if (expired) throw new ApiError('Expired', 'UNAUTHORIZED', 401)
      data = technician
    } else if (config.url === '/property') data = property
    else if (config.url === '/reports') data = reportPage([detail], 1, 10)
    else if (config.url?.endsWith('/start')) {
      await holdPost
      if (commitBeforeError || !startError) {
        const body = JSON.parse(config.data)
        detail = {
          ...detail,
          status: 'IN_PROGRESS',
          assignment: detail.assignment
            ? {
                ...detail.assignment,
                estimatedArrivalAt: body.estimatedArrivalAt,
              }
            : null,
        }
      }
      if (startError) {
        if (startError.statusCode === 401) expired = true
        throw startError
      }
      data = detail
    } else if (config.url === `/reports/${reportDetail.id}`) {
      await holdGet
      if (getError) {
        if (getError.statusCode === 401) expired = true
        throw getError
      }
      data = detail
    } else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  if (originalScroll)
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollIntoView',
      originalScroll,
    )
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  vi.useRealTimers()
  toast.close()
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
function reads() {
  return requests.filter((r) => r.url === `/reports/${reportDetail.id}`)
}
function writes() {
  return requests.filter((r) => r.url?.endsWith('/start'))
}
async function show(url = path, actor: Actor | null = technician) {
  client.setQueryData(sessionKey, actor)
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: [url] }),
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
async function open() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Start work' }))
  const sheet = await screen.findByRole('dialog', { name: 'Start work' })
  return {
    user,
    sheet,
    time: within(sheet).getByRole('button', { name: 'Arrival time (WIB)' }),
    date: within(sheet).getByRole('button', { name: 'Arrival date (WIB)' }),
  }
}
async function selectTime(
  user: ReturnType<typeof userEvent.setup>,
  hour: string,
  minute: string,
) {
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Choose arrival date' }),
    ).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Arrival time (WIB)' }))
  const hours = await screen.findByRole('listbox', { name: 'Hour' })
  const minutes = screen.getByRole('listbox', { name: 'Minute' })
  await user.click(within(hours).getByRole('option', { name: hour }))
  await user.click(within(minutes).getByRole('option', { name: minute }))
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Choose time' }),
    ).not.toBeInTheDocument(),
  )
}
async function send() {
  const opened = await open()
  await opened.user.click(opened.date)
  await opened.user.click(
    screen.getByRole('button', { name: /October 16th, 2026/ }),
  )
  await selectTime(opened.user, '14', '30')
  await opened.user.click(
    within(opened.sheet).getByRole('button', { name: 'Start' }),
  )
  return opened
}

it('opens a homepage card as one accessible link and returns home', async () => {
  const user = userEvent.setup()
  const { router } = await show('/technician')
  await user.click(
    await screen.findByRole('link', { name: `View task: ${detail.title}` }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Task details' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe(path)
  await user.click(screen.getByRole('link', { name: 'Back to home' }))
  expect(
    await screen.findByRole('heading', { name: 'Your ongoing tasks' }),
  ).toBeVisible()
})
it('supports direct links with one exact cancellable authenticated GET and isolated cache', async () => {
  await show()
  expect(
    await screen.findByRole('heading', { name: detail.title }),
  ).toBeVisible()
  expect(reads()).toHaveLength(1)
  expect(reads()[0]).toMatchObject({ method: 'get', withCredentials: true })
  expect(reads()[0].signal).toBeInstanceOf(AbortSignal)
  expect(
    technicianTaskDetailQueryOptions(technician.id, detail.id),
  ).toMatchObject({
    queryKey: ['technician', 'task', technician.id, detail.id],
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  })
  expect(
    requests.some((r) => r.url === '/resident/unit' || r.url === '/property'),
  ).toBe(false)
})
it('rejects invalid URL UUIDs without a report request', async () => {
  await show('/technician/tasks/not-a-uuid')
  expect(await screen.findByText(/Invalid report ID/)).toBeVisible()
  expect(reads()).toHaveLength(0)
})
it('leads with the prominent unit and report-only information, without status card, tabs or work results', async () => {
  detail = {
    ...completedReport,
    status: 'ASSIGNED',
    assignment: detail.assignment,
  }
  await show()
  const location = await screen.findByRole('region', { name: 'Task location' })
  expect(
    within(location).getByRole('heading', { name: 'Unit B-202' }),
  ).toBeVisible()
  expect(location).toHaveTextContent('Floor 2')
  expect(location).toHaveTextContent('Bring a drain-cleaning kit.')
  expect(screen.getByText('Status: Assigned')).toBeVisible()
  expect(screen.getByText(detail.reportNumber)).toBeVisible()
  expect(screen.getByText('2 Oct 2026, 01:30 WIB')).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Task status' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  for (const value of [
    'Work result',
    'Total cost (IDR)',
    'Internal note.',
    'Resident creator',
    'Repair photos',
  ])
    expect(screen.queryByText(value, { exact: false })).not.toBeInTheDocument()
})
it.each([
  'REPORTED',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
] as const)(
  'renders %s with only assigned tasks eligible to start',
  async (status) => {
    detail.status = status
    await show()
    await screen.findByRole('heading', { name: detail.title })
    expect(screen.queryByRole('button', { name: 'Start work' }) !== null).toBe(
      status === 'ASSIGNED',
    )
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  },
)
it('renders rejection, closed date, priority fallback and empty damage photos', async () => {
  detail = {
    ...detail,
    status: 'REJECTED',
    rejectionReason: 'Duplicate report.',
    closedAt: '2026-10-03T00:00:00Z',
    finalPriority: null,
  }
  await show()
  expect(await screen.findByText('Duplicate report.')).toBeVisible()
  expect(screen.getByText('3 Oct 2026, 07:00 WIB')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByText('No damage photos')).toBeVisible()
})
it('previews damage photos with Escape and focus restoration', async () => {
  detail.damagePhotos = [photo]
  const user = userEvent.setup()
  await show()
  const trigger = await screen.findByRole('button', {
    name: 'View damage photo 1',
  })
  await user.click(trigger)
  expect(await screen.findByRole('dialog')).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(trigger).toHaveFocus())
})
it('shows skeleton and retry without automatic retries', async () => {
  const pending = deferred()
  holdGet = pending.promise
  const user = userEvent.setup()
  await show()
  expect(
    await screen.findByRole('status', { name: 'Loading task details' }),
  ).toBeVisible()
  getError = new ApiError('Offline', 'NETWORK_ERROR')
  await act(() => pending.release())
  expect(await screen.findByText('We couldn’t load this task.')).toBeVisible()
  expect(reads()).toHaveLength(1)
  getError = undefined
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(
    await screen.findByRole('heading', { name: detail.title }),
  ).toBeVisible()
})
it('retains refresh data, disables Start work and recovers with Retry', async () => {
  await show()
  await screen.findByText('Status: Assigned')
  getError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await act(() =>
    client.refetchQueries({
      queryKey: technicianTaskDetailQueryOptions(technician.id, detail.id)
        .queryKey,
    }),
  )
  expect(
    await screen.findByText(/Showing the last available information/),
  ).toBeVisible()
  expect(screen.getByRole('heading', { name: detail.title })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Start work' })).toBeDisabled()
  getError = undefined
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Start work' })).toBeEnabled(),
  )
})
it.each([403, 404])('hides cached details on GET %s', async (status) => {
  await show()
  await screen.findByText('Status: Assigned')
  getError = new ApiError('Unavailable', 'HTTP_ERROR', status)
  await act(() =>
    client.refetchQueries({
      queryKey: technicianTaskDetailQueryOptions(technician.id, detail.id)
        .queryKey,
    }),
  )
  expect(await screen.findByText(/This task is unavailable/)).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: detail.title }),
  ).not.toBeInTheDocument()
  expect(client.getQueryData(sessionKey)).toEqual(technician)
})
it('suppresses another technician’s assignment', async () => {
  detail.assignment!.technician = {
    id: '33000000-0000-4000-8000-000000000005',
    name: 'Other technician',
  }
  await show()
  expect(await screen.findByText(/This task is unavailable/)).toBeVisible()
  expect(screen.queryByText(detail.description)).not.toBeInTheDocument()
})
it('requires arrival with focused associated validation and discards a cancelled draft', async () => {
  await show()
  const { user, sheet, date } = await open()
  await user.click(within(sheet).getByRole('button', { name: 'Start' }))
  expect(
    await within(sheet).findByText('Choose an estimated arrival date.'),
  ).toBeVisible()
  await waitFor(() => expect(date).toHaveFocus())
  expect(date).toHaveAttribute('aria-invalid', 'true')
  expect(writes()).toHaveLength(0)
  await selectTime(user, '14', '30')
  await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Start work' })).toHaveFocus()
  vi.setSystemTime(new Date('2026-10-16T04:15:00Z'))
  const reopened = await open()
  expect(reopened.time).toHaveTextContent('11:15')
  expect(reopened.date).toHaveTextContent('Select date')
})
it('sends one exact WIB payload, updates in place, invalidates tasks and focuses the report title', async () => {
  await client.fetchQuery(technicianTasksQueryOptions(technician.id))
  await show()
  await send()
  expect(await screen.findByText('Status: In progress')).toBeVisible()
  expect(writes()).toHaveLength(1)
  expect(writes()[0]).toMatchObject({ method: 'post', withCredentials: true })
  expect(JSON.parse(writes()[0].data)).toEqual({
    estimatedArrivalAt: '2026-10-16T07:30:00.000Z',
  })
  expect(writes()[0].signal).toBeInstanceOf(AbortSignal)
  expect(
    screen.getByText('Estimated arrival: 16 Oct 2026, 14:30 WIB'),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Start work' }),
  ).not.toBeInTheDocument()
  expect(
    client.getQueryState(technicianTasksQueryOptions(technician.id).queryKey)
      ?.isInvalidated,
  ).toBe(true)
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: detail.title })).toHaveFocus(),
  )
})
it('blocks duplicate submission, Escape, outside press and Cancel while pending', async () => {
  const pending = deferred()
  holdPost = pending.promise
  await show()
  const { user } = await send()
  expect(
    await screen.findByRole('dialog', { name: 'Action in progress' }),
  ).toBeVisible()
  await user.keyboard('{Escape}{Escape}')
  fireEvent.submit(document.getElementById('task-start-form')!)
  fireEvent.pointerDown(document.body)
  expect(writes()).toHaveLength(1)
  expect(
    screen.getByRole('dialog', { name: 'Action in progress' }),
  ).toBeVisible()
  await act(() => pending.release())
  expect(await screen.findByText('Status: In progress')).toBeVisible()
})
it('retains arrival after a server field error and focuses it', async () => {
  startError = new ApiError('Check arrival.', 'VALIDATION_ERROR', 400, {
    issues: [{ path: ['estimatedArrivalAt'], message: 'Arrival is invalid.' }],
  })
  await show()
  const { time, date } = await send()
  expect(await screen.findByText('Arrival is invalid.')).toBeVisible()
  expect(time).toHaveTextContent('14:30')
  await waitFor(() => expect(date).toHaveFocus())
  expect(writes()).toHaveLength(1)
})
it('closes obsolete input and refreshes after conflict without repeating POST', async () => {
  startError = new ApiError('Task already started.', 'CONFLICT', 409)
  await show()
  await send()
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Start work' }),
    ).not.toBeInTheDocument(),
  )
  expect(reads()).toHaveLength(2)
  expect(writes()).toHaveLength(1)
})
it.each([403, 404])(
  'hides details after start loses access (%s)',
  async (status) => {
    startError = new ApiError('Unavailable', 'HTTP_ERROR', status)
    await show()
    await send()
    expect(await screen.findByText(/This task is unavailable/)).toBeVisible()
    expect(screen.queryByText(detail.description)).not.toBeInTheDocument()
  },
)
it('reconciles a lost success response by GET without a second POST', async () => {
  startError = new ApiError('Lost response.', 'NETWORK_ERROR')
  commitBeforeError = true
  await show()
  await send()
  expect(await screen.findByText('Status: In progress')).toBeVisible()
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(reads()).toHaveLength(2)
  expect(writes()).toHaveLength(1)
})
it('retains the arrival if reconciliation confirms Assigned', async () => {
  startError = new ApiError('Timeout.', 'TIMEOUT')
  await show()
  const { time } = await send()
  expect(
    await screen.findByText(
      'Work has not started. Check your arrival estimate and try again.',
    ),
  ).toBeVisible()
  expect(time).toHaveTextContent('14:30')
  expect(writes()).toHaveLength(1)
})
it('blocks another POST until an uncertain outcome has a successful read', async () => {
  startError = new ApiError('Timeout.', 'TIMEOUT')
  await show()
  await screen.findByText('Status: Assigned')
  getError = new ApiError('Offline', 'NETWORK_ERROR')
  const { sheet } = await send()
  expect(
    await screen.findByText(/We couldn’t confirm whether work started/),
  ).toBeVisible()
  expect(within(sheet).getByRole('button', { name: 'Start' })).toBeDisabled()
  expect(writes()).toHaveLength(1)
})
it.each(['get', 'post'])(
  'expires the session and clears private details on %s 401',
  async (method) => {
    if (method === 'get')
      getError = new ApiError('Expired', 'UNAUTHORIZED', 401)
    else startError = new ApiError('Expired', 'UNAUTHORIZED', 401)
    await show()
    if (method === 'post') await send()
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible()
    expect(
      client.getQueryData(
        technicianTaskDetailQueryOptions(technician.id, detail.id).queryKey,
      ),
    ).toBeUndefined()
  },
)
it('cancels a pending detail GET on unmount', async () => {
  const pending = deferred()
  holdGet = pending.promise
  const view = await show()
  await screen.findByRole('status', { name: 'Loading task details' })
  view.unmount()
  expect(reads()[0].signal?.aborted).toBe(true)
  await act(() => pending.release())
})
it('cancels pending start on unmount and ignores the late response', async () => {
  const pending = deferred()
  holdPost = pending.promise
  const view = await show()
  await send()
  view.unmount()
  expect(writes()[0].signal?.aborted).toBe(true)
  await act(() => pending.release())
  expect(
    client.getQueryData(
      technicianTaskDetailQueryOptions(technician.id, detail.id).queryKey,
    ),
  ).toMatchObject({ status: 'ASSIGNED' })
})
it('does not restore a previous session’s detail after a late successful start', async () => {
  const pending = deferred()
  holdPost = pending.promise
  await show()
  await send()
  await act(() => expireSession(client))
  await act(() => pending.release())
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(
    client.getQueryData(
      technicianTaskDetailQueryOptions(technician.id, detail.id).queryKey,
    ),
  ).toBeUndefined()
})
it.each(['ADMIN', 'RESIDENT'] as const)(
  'blocks %s from a direct detail URL',
  async (role) => {
    await show(path, { ...technician, role })
    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeVisible()
    expect(reads()).toHaveLength(0)
  },
)
it('redirects guest direct links to login', async () => {
  const { router } = await show(path, null)
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(router.state.location.search).toMatchObject({ redirect: path })
})
it('rejects invalid, past and current WIB arrivals and accepts strictly future values', () => {
  for (const arrivalDate of ['', '2026-02-30', '2026-13-16'])
    expect(
      startWorkFormSchema.safeParse({ arrivalDate, arrivalTime: '14:30' })
        .success,
    ).toBe(false)
  for (const arrivalTime of ['', '24:00', '14:61'])
    expect(
      startWorkFormSchema.safeParse({ arrivalDate: '2026-10-16', arrivalTime })
        .success,
    ).toBe(false)
  for (const values of [
    { arrivalDate: '2026-10-15', arrivalTime: '23:59' },
    { arrivalDate: '2026-10-16', arrivalTime: '09:59' },
    { arrivalDate: '2026-10-16', arrivalTime: '10:00' },
  ])
    expect(startWorkFormSchema.safeParse(values).success).toBe(false)
  expect(
    startWorkPayload({ arrivalDate: '2026-10-16', arrivalTime: '10:01' }),
  ).toEqual({ estimatedArrivalAt: '2026-10-16T03:01:00.000Z' })
  expect(
    startWorkPayload({ arrivalDate: '2026-10-17', arrivalTime: '00:00' }),
  ).toEqual({ estimatedArrivalAt: '2026-10-16T17:00:00.000Z' })
})
it('disables past calendar dates while allowing today, and keeps the sheet open on calendar Escape', async () => {
  await show()
  const { user, sheet, date, time } = await open()
  expect(time).toHaveTextContent('10:00')
  await user.click(date)
  expect(
    await screen.findByRole('dialog', { name: 'Choose arrival date' }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: /October 15th, 2026/ }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: /October 16th, 2026/ }),
  ).toBeEnabled()
  await user.keyboard('{Escape}')
  expect(sheet).toBeVisible()
  await waitFor(() => expect(date).toHaveFocus())
  await user.click(date)
  await user.click(screen.getByRole('button', { name: /October 16th, 2026/ }))
  await user.click(within(sheet).getByRole('button', { name: 'Start' }))
  expect(
    await screen.findByText(
      'Choose an arrival date and time later than now (WIB).',
    ),
  ).toBeVisible()
  await waitFor(() => expect(time).toHaveFocus())
  expect(time).toHaveAttribute(
    'aria-describedby',
    'task-arrival-time-value task-arrival-time-error',
  )
  expect(time).toHaveAttribute('aria-invalid', 'true')
  expect(writes()).toHaveLength(0)
  await selectTime(user, '10', '01')
  await user.click(within(sheet).getByRole('button', { name: 'Start' }))
  expect(await screen.findByText('Status: In progress')).toBeVisible()
})
it('revalidates the current clock when submitting a draft that has become stale', async () => {
  await show()
  const { user, sheet, date } = await open()
  await user.click(date)
  await user.click(screen.getByRole('button', { name: /October 16th, 2026/ }))
  await selectTime(user, '14', '30')
  vi.setSystemTime(new Date('2026-10-16T07:30:01Z'))
  await user.click(within(sheet).getByRole('button', { name: 'Start' }))
  expect(
    await screen.findByText(
      'Choose an arrival date and time later than now (WIB).',
    ),
  ).toBeVisible()
  expect(writes()).toHaveLength(0)
})
it('uses the Jakarta date boundary and rechecks calendar limits after midnight', async () => {
  vi.setSystemTime(new Date('2026-10-16T17:00:01Z'))
  expect(
    startWorkFormSchema.safeParse({
      arrivalDate: '2026-10-17',
      arrivalTime: '00:00',
    }).success,
  ).toBe(false)
  expect(
    startWorkFormSchema.safeParse({
      arrivalDate: '2026-10-17',
      arrivalTime: '00:01',
    }).success,
  ).toBe(true)
  await show()
  const { user, date } = await open()
  await user.click(date)
  expect(
    screen.getByRole('button', { name: /October 16th, 2026/ }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: /October 17th, 2026/ }),
  ).toBeEnabled()
})
it('uses one combined time field with keyboard columns and discards an unconfirmed popup draft', async () => {
  await show()
  const { user, sheet, time } = await open()
  expect(within(sheet).queryByRole('combobox')).not.toBeInTheDocument()
  await user.click(time)
  const hours = await screen.findByRole('listbox', { name: 'Hour' })
  const minutes = screen.getByRole('listbox', { name: 'Minute' })
  expect(within(hours).getAllByRole('option')).toHaveLength(24)
  expect(within(minutes).getAllByRole('option')).toHaveLength(60)
  within(hours).getByRole('option', { selected: true }).focus()
  await user.keyboard('{End}')
  within(minutes).getByRole('option', { selected: true }).focus()
  await user.keyboard('{End}')
  expect(time).toHaveTextContent('10:00')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(time).toHaveTextContent('23:59')
  await user.click(time)
  const reopened = await screen.findByRole('listbox', { name: 'Hour' })
  within(reopened).getByRole('option', { selected: true }).focus()
  await user.keyboard('{Home}{Escape}')
  expect(sheet).toBeVisible()
  expect(time).toHaveTextContent('23:59')
  await waitFor(() => expect(time).toHaveFocus())
})
it('validates the returned identity, status and saved arrival before using a start response', async () => {
  apiClient.defaults.adapter = async (config) => ({
    data: detail,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  const payload = { estimatedArrivalAt: '2026-10-16T07:30:00Z' }
  await expect(startTask(detail.id, payload)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
  detail = {
    ...detail,
    status: 'IN_PROGRESS',
    assignment: {
      ...detail.assignment!,
      estimatedArrivalAt: payload.estimatedArrivalAt,
    },
  }
  await expect(
    startTask('55000000-0000-4000-8000-000000000099', payload),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  detail.assignment!.estimatedArrivalAt = '2026-10-16T08:30:00Z'
  await expect(startTask(detail.id, payload)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
