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
import { dashboardSummaryQueryOptions } from '@/features/admin/dashboard/dashboard-queries'
import { reportsKey } from '@/features/admin/reports/report-queries'
import { admin, property } from '../settings/fixtures'
import { reportPage } from '../reports/fixtures'
import { summary, dashboardReports } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: AxiosRequestConfig[]
let summaryBody: unknown
let summaryError: ApiError | undefined
let queueError: string | undefined
let empty: boolean
let hold: Promise<void> | undefined
let holdQueues: Promise<void> | undefined
let sessionActor: typeof admin | null
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  requests = []
  summaryBody = summary
  summaryError = undefined
  queueError = undefined
  empty = false
  hold = undefined
  holdQueues = undefined
  sessionActor = admin
  apiClient.defaults.adapter = async (config) => {
    let data: unknown
    if (config.url === '/auth/me') {
      if (!sessionActor)
        throw new ApiError('Session expired.', 'UNAUTHORIZED', 401)
      data = sessionActor
    } else if (config.url === '/property') data = property
    else if (config.url === '/dashboard/summary') {
      requests.push(config)
      if (hold) await hold
      if (summaryError) throw summaryError
      data = summaryBody
    } else if (config.url === '/reports') {
      requests.push(config)
      if (holdQueues) await holdQueues
      const status = config.params.status
      if (queueError === status)
        throw new ApiError('Queue offline.', 'NETWORK_ERROR')
      data = reportPage(
        empty ? [] : dashboardReports.map((report) => ({ ...report, status })),
        1,
        config.params.pageSize,
        empty ? 0 : status === 'REPORTED' ? 83 : status === 'VERIFIED' ? 12 : 7,
      )
    } else throw new Error(`Unexpected request: ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})
async function show(path = '/admin') {
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
async function ready() {
  await screen.findByText('Rp 28.750.000,50')
  await screen.findByRole('tab', { name: 'Needs review 83' })
}
it('renders live exact metrics, real totals, five previews and the chosen icon-free Contour cards', async () => {
  await show()
  await ready()
  const metrics = screen.getByRole('region', { name: 'Maintenance summary' })
  expect(within(metrics).getByText('24')).toBeInTheDocument()
  expect(within(metrics).getByText('8')).toBeInTheDocument()
  expect(within(metrics).getByText('17')).toBeInTheDocument()
  expect(
    within(metrics).getByText('All time · Closed reports only'),
  ).toBeInTheDocument()
  expect(
    within(metrics).getByText(
      new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      }).format(new Date()),
    ),
  ).toBeInTheDocument()
  expect(metrics.querySelectorAll('.dashboard-contour')).toHaveLength(4)
  expect(metrics.querySelector('svg')).toBeNull()
  expect(screen.queryByText('Demo data')).not.toBeInTheDocument()
  expect(screen.getByText('128')).toBeInTheDocument()
  expect(screen.getByText('486')).toBeInTheDocument()
  expect(requests).toHaveLength(4)
  expect(
    requests.filter((r) => r.url === '/reports').map((r) => r.params),
  ).toEqual(
    ['REPORTED', 'VERIFIED', 'COMPLETED'].map((status) => ({
      status,
      page: 1,
      pageSize: 5,
    })),
  )
  const table = screen.getByRole('table', { name: 'Needs review' })
  expect(within(table).getAllByRole('link')).toHaveLength(5)
  expect(within(table).getAllByRole('row')).toHaveLength(6)
  expect(within(table).getByText('High')).toBeInTheDocument()
  expect(within(table).getAllByText('Reported')).toHaveLength(5)
  expect(within(table).getAllByText('2 Oct 2026, 01:30')).toHaveLength(5)
  expect(
    screen.getByText('Latest 5 of 83 · by reported date'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Create report' })).toHaveAttribute(
    'href',
    '/admin/reports/new',
  )
  expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
    'href',
    '/admin/reports?status=REPORTED',
  )
  expect(within(table).getAllByRole('link')[0]).toHaveAttribute(
    'href',
    `/admin/reports/${dashboardReports[0].id}?status=REPORTED`,
  )
})
it('keeps queue selection in URLs and supports keyboard selection and browser history', async () => {
  const user = userEvent.setup()
  const router = await show('/admin?queue=assignment')
  await ready()
  expect(
    screen.getByRole('tab', { name: 'Needs technician 12' }),
  ).toHaveAttribute('aria-selected', 'true')
  await user.click(screen.getByRole('tab', { name: 'Ready for review 7' }))
  await waitFor(() =>
    expect(router.state.location.search.queue).toBe('closure'),
  )
  expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
    'href',
    '/admin/reports?status=COMPLETED',
  )
  await act(() => router.history.back())
  await waitFor(() =>
    expect(
      screen.getByRole('tab', { name: 'Needs technician 12' }),
    ).toHaveAttribute('aria-selected', 'true'),
  )
  screen.getByRole('tab', { name: 'Needs technician 12' }).focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Ready for review 7' })).toHaveFocus()
  await user.keyboard('{Home}')
  await waitFor(() =>
    expect(
      screen.getByRole('tab', { name: 'Needs review 83' }),
    ).toHaveAttribute('aria-selected', 'true'),
  )
  expect(screen.getByRole('tab', { name: 'Needs review 83' })).toHaveFocus()
})
it('uses skeletons rather than zeros until independent reads succeed', async () => {
  let finish!: () => void
  hold = new Promise<void>((resolve) => {
    finish = resolve
  })
  holdQueues = hold
  await show()
  expect(
    await screen.findByText('Loading maintenance summary…'),
  ).toBeInTheDocument()
  const metrics = screen.getByRole('region', { name: 'Maintenance summary' })
  expect(metrics.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4)
  expect(within(metrics).queryByText('0')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Needs review/ })).toHaveTextContent(
    '—',
  )
  await act(async () => {
    finish()
  })
  await ready()
})
it('shows confirmed zero figures and distinct empty queues', async () => {
  summaryBody = {
    totalUnits: 0,
    totalReports: 0,
    activeReports: 0,
    inProgressReports: 0,
    closedReportsThisMonth: 0,
    totalClosedCost: '0.00',
  }
  empty = true
  const user = userEvent.setup()
  await show()
  expect(await screen.findByText('Rp 0,00')).toBeInTheDocument()
  expect(await screen.findByText('No reports need review.')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Needs technician 0' }))
  expect(
    await screen.findByText('No reports need a technician.'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Ready for review 0' }))
  expect(
    await screen.findByText('No completed work to review.'),
  ).toBeInTheDocument()
})
it('isolates initial summary and queue failures, and retries only the failed section', async () => {
  summaryError = new ApiError('Summary offline.', 'NETWORK_ERROR')
  queueError = 'VERIFIED'
  const user = userEvent.setup()
  await show()
  expect(await screen.findByText(/Summary offline/)).toBeInTheDocument()
  expect(
    await screen.findByRole('tab', { name: 'Needs review 83' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('tab', { name: /Needs technician/ }),
  ).toHaveTextContent('—')
  summaryError = undefined
  await user.click(screen.getByRole('button', { name: 'Retry summary' }))
  expect(await screen.findByText('Rp 28.750.000,50')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Needs technician/ }))
  expect(await screen.findByText('Queue offline.')).toBeInTheDocument()
  queueError = undefined
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('tab', { name: 'Needs technician 12' }),
  ).toBeInTheDocument()
  expect(
    requests.filter(
      (r) => r.url === '/reports' && r.params.status === 'REPORTED',
    ),
  ).toHaveLength(1)
})
it('retains loaded figures and rows during ordinary refresh failure', async () => {
  await show()
  await ready()
  summaryError = new ApiError('Summary refresh failed.', 'NETWORK_ERROR')
  queueError = 'REPORTED'
  await act(async () => {
    await Promise.all([
      client.refetchQueries({
        queryKey: dashboardSummaryQueryOptions().queryKey,
      }),
      client.refetchQueries({ queryKey: [...reportsKey, 'list'] }),
    ])
  })
  expect(screen.getByText('Rp 28.750.000,50')).toBeInTheDocument()
  expect(
    await screen.findByText(/Showing the last loaded figures/),
  ).toBeInTheDocument()
  expect(
    await screen.findByText(/Showing the last loaded reports/),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('table', { name: 'Needs review' })).getAllByRole(
      'link',
    ),
  ).toHaveLength(5)
})
it('hides cached dashboard data immediately on forbidden refresh and rechecks the actor', async () => {
  await show()
  await ready()
  summaryError = new ApiError('Forbidden', 'FORBIDDEN', 403)
  await act(async () => {
    await client.refetchQueries({
      queryKey: dashboardSummaryQueryOptions().queryKey,
    })
  })
  await waitFor(() =>
    expect(screen.queryByText('Rp 28.750.000,50')).not.toBeInTheDocument(),
  )
  expect(
    screen.queryByRole('region', { name: 'Maintenance summary' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Dashboard access could not be confirmed',
  )
})

it('removes private figures and returns to login when a dashboard read expires the session', async () => {
  await show()
  await ready()
  summaryError = new ApiError('Session expired.', 'UNAUTHORIZED', 401)
  sessionActor = null
  await act(async () => {
    await client.refetchQueries({
      queryKey: dashboardSummaryQueryOptions().queryKey,
    })
  })
  await waitFor(() =>
    expect(screen.queryByText('Rp 28.750.000,50')).not.toBeInTheDocument(),
  )
  expect(
    await screen.findByRole('heading', { name: 'Sign in' }),
  ).toBeInTheDocument()
  expect(
    client.getQueryData(dashboardSummaryQueryOptions().queryKey),
  ).toBeUndefined()
})
it('removes figures when session revalidation discovers a different role', async () => {
  await show()
  await ready()
  sessionActor = { ...admin, role: 'RESIDENT' }
  summaryError = new ApiError('Forbidden', 'FORBIDDEN', 403)
  await act(async () => {
    await client.refetchQueries({
      queryKey: dashboardSummaryQueryOptions().queryKey,
    })
  })
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument(),
  )
  expect(screen.queryByText('Rp 28.750.000,50')).not.toBeInTheDocument()
  expect(
    client.getQueryData(dashboardSummaryQueryOptions().queryKey),
  ).toBeUndefined()
})
it('defaults invalid queue URLs to review and preserves very large monetary precision', async () => {
  summaryBody = {
    ...summary,
    totalClosedCost: '900719925474099312345678901234.50',
  }
  await show('/admin?queue=invalid')
  expect(
    await screen.findByRole('tab', { name: 'Needs review 83' }),
  ).toHaveAttribute('aria-selected', 'true')
  expect(
    await screen.findByText('Rp 900.719.925.474.099.312.345.678.901.234,50'),
  ).toBeInTheDocument()
})
