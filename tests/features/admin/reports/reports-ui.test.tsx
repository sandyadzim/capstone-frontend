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
import { reportsKey } from '@/features/admin/reports/report-queries'
import {
  reportStatusSchema,
  type ReportListItem,
} from '@/features/admin/reports/report-schema'
import { reportStatusLabels } from '@/features/admin/reports/report-labels'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import { admin, property } from '../settings/fixtures'
import { report, reportPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let reports: ReportListItem[]
let requests: AxiosRequestConfig[]
let readError: ApiError | undefined
let pendingRead: Promise<void> | undefined

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  useAdminUiStore.setState({ collapsed: false })
  client = createQueryClient()
  reports = [{ ...report }]
  requests = []
  readError = undefined
  pendingRead = undefined
  apiClient.defaults.adapter = async (config) => {
    let data: unknown
    if (config.url === '/auth/me') data = admin
    else if (config.url === '/property') data = property
    else if (config.url === '/reports' && config.method === 'get') {
      requests.push(config)
      if (pendingRead) await pendingRead
      if (readError) throw readError
      const {
        q = '',
        status,
        category,
        priority,
        dateFrom,
        dateTo,
        page = 1,
        pageSize = 20,
      } = config.params ?? {}
      const filtered = reports.filter((value) => {
        const date = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(value.reportedAt))
        return (
          (!status || value.status === status) &&
          (!category || value.category === category) &&
          (!priority ||
            (value.finalPriority ?? value.proposedPriority) === priority) &&
          (!dateFrom || date >= dateFrom) &&
          (!dateTo || date <= dateTo) &&
          (value.reportNumber.toLowerCase().includes(q.toLowerCase()) ||
            value.title.toLowerCase().includes(q.toLowerCase()))
        )
      })
      data = reportPage(
        filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        filtered.length,
      )
    } else throw new Error(`Unexpected request: ${config.method} ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})

async function show(path = '/admin/reports', actor = admin) {
  client.setQueryData(sessionKey, actor)
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

it('loads a read-only list with every field on desktop and mobile and Jakarta dates', async () => {
  reports = reportStatusSchema.options.map((status, index) => ({
    ...report,
    status,
    id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    reportNumber: `RPT-${index + 1}`,
    finalPriority: index === 0 ? 'HIGH' : null,
    proposedPriority: index === 1 ? null : 'MEDIUM',
  }))
  await show()
  const table = await screen.findByRole('table', { name: 'Reports' })
  const headers = [
    'Report ID',
    'Report Title',
    'Unit',
    'Category',
    'Priority',
    'Status',
    'Reported Date',
    'Actions',
  ]
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((node) => node.textContent),
  ).toEqual(headers)
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(rows[0]).getByText('High')).toBeInTheDocument()
  expect(within(rows[0]).queryByText('Medium')).not.toBeInTheDocument()
  expect(within(rows[1]).getByText('—')).toBeInTheDocument()
  expect(within(rows[2]).getByText('Medium')).toBeInTheDocument()
  expect(within(table).getAllByText('2 Oct 2026, 01:30')).toHaveLength(7)
  for (const status of reportStatusSchema.options)
    expect(
      within(table).getByText(reportStatusLabels[status]),
    ).toBeInTheDocument()
  const mobile = screen.getByRole('list', { name: 'Reports records' })
  for (const row of within(mobile).getAllByRole('listitem'))
    expect(
      [...row.querySelectorAll('dt')].map((node) => node.textContent),
    ).toEqual(headers)
  expect(within(table).getAllByRole('link', { name: /^RPT-/ })).toHaveLength(7)
  expect(within(mobile).getAllByRole('link', { name: /^RPT-/ })).toHaveLength(7)
  expect(
    within(table).getAllByRole('button', { name: /^Actions for/ }),
  ).toHaveLength(7)
  expect(
    within(mobile).getAllByRole('button', { name: /^Actions for/ }),
  ).toHaveLength(7)
  expect(screen.getByRole('link', { name: 'Create report' })).toHaveAttribute(
    'href',
    '/admin/reports/new',
  )
  expect(
    screen.queryByRole('button', { name: /view/i }),
  ).not.toBeInTheDocument()
  expect(requests[0].params).toMatchObject({ page: 1, pageSize: 20 })
  expect(
    within(screen.getByRole('group', { name: 'List filters' }))
      .getAllByRole('combobox')
      .map(
        (node) =>
          node.getAttribute('aria-labelledby') &&
          document.getElementById(node.getAttribute('aria-labelledby')!)
            ?.textContent,
      ),
  ).toEqual(['Category', 'Status', 'Priority'])
  expect(
    screen.queryByText(/Dates filter the reported date/),
  ).not.toBeInTheDocument()
})

it('debounces and trims search, matches report numbers, and clears without losing other filters', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/reports?category=AC&pageSize=10')
  await screen.findByRole('table', { name: 'Reports' })
  requests.length = 0
  const input = screen.getByRole('searchbox', { name: 'Search' })
  await user.type(input, ' RPT-0000000001 ')
  expect(requests).toHaveLength(0)
  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0].params).toMatchObject({
    q: 'RPT-0000000001',
    category: 'AC',
    page: 1,
    pageSize: 10,
  })
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  await waitFor(() => expect(router.state.location.search.q).toBeUndefined())
  expect(input).toHaveFocus()
  expect(router.state.location.search.category).toBe('AC')
})

it('combines and independently clears all selects with keyboard selection and focus restoration', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/reports?q=AC&dateFrom=2026-10-02')
  await screen.findByRole('table', { name: 'Reports' })
  for (const [label, option] of [
    ['Status', 'Reported'],
    ['Category', 'AC'],
    ['Priority', 'Medium'],
  ]) {
    const select = screen.getByRole('combobox', { name: label })
    select.focus()
    await user.keyboard('{ArrowDown}')
    await user.click(await screen.findByRole('option', { name: option }))
  }
  await waitFor(() =>
    expect(requests.at(-1)?.params).toMatchObject({
      q: 'AC',
      status: 'REPORTED',
      category: 'AC',
      priority: 'MEDIUM',
      dateFrom: '2026-10-02',
      page: 1,
    }),
  )
  for (const [label, key] of [
    ['Status', 'status'],
    ['Category', 'category'],
    ['Priority', 'priority'],
  ] as const) {
    await user.click(
      screen.getByRole('button', { name: `Clear ${label.toLowerCase()}` }),
    )
    await waitFor(() =>
      expect(router.state.location.search[key]).toBeUndefined(),
    )
    expect(screen.getByRole('combobox', { name: label })).toHaveFocus()
    expect(router.state.location.search).toMatchObject({
      q: 'AC',
      dateFrom: '2026-10-02',
    })
  }
})

it('applies a calendar range together, resets the page, and clears both boundaries with focus restored', async () => {
  const user = userEvent.setup()
  const router = await show(
    '/admin/reports?dateFrom=2026-10-01&dateTo=2026-10-02&category=AC',
  )
  await screen.findByRole('table', { name: 'Reports' })
  requests.length = 0
  await user.click(screen.getByRole('button', { name: 'Reported Date' }))
  await user.click(
    await screen.findByRole('button', { name: /October 3rd, 2026/ }),
  )
  expect(requests).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() =>
    expect(requests.at(-1)?.params).toMatchObject({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-03',
      category: 'AC',
      page: 1,
    }),
  )
  expect(
    screen.getByRole('button', { name: 'Reported Date' }),
  ).toHaveAccessibleDescription('01 Oct 2026 – 03 Oct 2026')
  await user.click(screen.getByRole('button', { name: 'Clear reported date' }))
  await waitFor(() =>
    expect(router.state.location.search.dateFrom).toBeUndefined(),
  )
  expect(router.state.location.search.dateTo).toBeUndefined()
  expect(router.state.location.search.category).toBe('AC')
  expect(screen.getByRole('button', { name: 'Reported Date' })).toHaveFocus()
})

it('preserves reversed direct URL dates for correction without reading reports', async () => {
  const user = userEvent.setup()
  const router = await show(
    '/admin/reports?dateFrom=2026-10-11&dateTo=2026-10-01',
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Start date must be on or before end date.',
  )
  expect(requests).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Reported Date' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Page size' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear reported date' }))
  await screen.findByRole('table', { name: 'Reports' })
  expect(router.state.location.search.dateFrom).toBeUndefined()
  expect(router.state.location.search.dateTo).toBeUndefined()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('preserves URL filters across pagination and history and resets page when page size or filters change', async () => {
  reports = Array.from({ length: 25 }, (_, index) => ({
    ...report,
    id: `55000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
  }))
  const user = userEvent.setup()
  const router = await show(
    '/admin/reports?q=cooling&category=AC&priority=MEDIUM&dateFrom=2026-10-02&pageSize=10',
  )
  await screen.findByRole('table', { name: 'Reports' })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(router.state.location.search.page).toBe(2))
  expect(router.state.location.search).toMatchObject({
    q: 'cooling',
    category: 'AC',
    priority: 'MEDIUM',
    dateFrom: '2026-10-02',
    pageSize: 10,
  })
  await act(async () => {
    router.history.back()
  })
  await waitFor(() => expect(router.state.location.search.page).toBeUndefined())
  await act(async () => {
    router.history.forward()
  })
  await waitFor(() => expect(router.state.location.search.page).toBe(2))
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Page size' })).toBeEnabled(),
  )
  await user.click(screen.getByRole('combobox', { name: 'Page size' }))
  await user.click(await screen.findByRole('option', { name: '20' }))
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      q: 'cooling',
      category: 'AC',
      priority: 'MEDIUM',
      dateFrom: '2026-10-02',
    }),
  )
  expect(router.state.location.search.page).toBeUndefined()
  expect(router.state.location.search.pageSize).toBeUndefined()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled(),
  )
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(router.state.location.search.page).toBe(2))
  await user.click(screen.getByRole('button', { name: 'Clear priority' }))
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      category: 'AC',
      q: 'cooling',
    }),
  )
})

it.each([0, 25])(
  'corrects an out-of-range page for total %s',
  async (total) => {
    reports = Array.from({ length: total }, (_, index) => ({
      ...report,
      id: `55000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    }))
    const router = await show('/admin/reports?page=99&pageSize=10')
    await waitFor(() =>
      expect(router.state.location.search.page).toBe(total ? 3 : undefined),
    )
    await waitFor(() =>
      expect(requests.at(-1)?.params.page).toBe(total ? 3 : 1),
    )
  },
)

it('retains records for a background refresh but hides previous records during a different filter read', async () => {
  let ready!: () => void
  pendingRead = new Promise((resolve) => {
    ready = resolve
  })
  await show()
  expect(screen.getByRole('status')).toHaveTextContent('Loading reports…')
  expect(screen.getByRole('status')).toHaveClass('sr-only')
  pendingRead = undefined
  await act(async () => ready())
  await screen.findByRole('table', { name: 'Reports' })
  pendingRead = new Promise((resolve) => {
    ready = resolve
  })
  await act(async () => {
    void client.invalidateQueries({ queryKey: reportsKey })
  })
  expect(screen.getByRole('table', { name: 'Reports' })).toBeInTheDocument()
  expect(await screen.findByText('Updating reports…')).toHaveClass('sr-only')
  pendingRead = undefined
  await act(async () => ready())
  pendingRead = new Promise((resolve) => {
    ready = resolve
  })
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Status' }))
  await user.click(await screen.findByRole('option', { name: 'Closed' }))
  expect(await screen.findByText('Loading reports…')).toHaveClass('sr-only')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  pendingRead = undefined
  await act(async () => ready())
  expect(
    await screen.findByText('No reports match your filters.'),
  ).toBeInTheDocument()
})

it('shows backend read errors and retries successfully', async () => {
  readError = new ApiError('Report service is unavailable.', 'HTTP_ERROR', 503)
  const user = userEvent.setup()
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Report service is unavailable.',
  )
  readError = undefined
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('table', { name: 'Reports' })
})

it.each([
  ['/admin/reports', 'No reports yet.'],
  ['/admin/reports?q=missing', 'No reports match your filters.'],
  ['/admin/reports?dateTo=2026-09-30', 'No reports match your filters.'],
])('distinguishes empty results at %s', async (path, message) => {
  reports = []
  await show(path)
  expect(await screen.findByText(message)).toBeInTheDocument()
})

it.each(['RESIDENT', 'TECHNICIAN'] as const)(
  'blocks report reads for the %s role',
  async (role) => {
    await show('/admin/reports', { ...admin, role })
    await screen.findByRole('heading', { name: 'Access denied' })
    expect(requests).toHaveLength(0)
  },
)

it('expires the shared session after a private 401', async () => {
  readError = new ApiError('Session expired.', 'UNAUTHORIZED', 401)
  await show()
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(
    client
      .getQueryCache()
      .findAll({ queryKey: reportsKey })
      .every((query) => query.state.data === undefined),
  ).toBe(true)
})

it('preserves dashboard priority ordering through filters, details and pagination without rendering sort controls', async () => {
  reports = Array.from({ length: 11 }, (_, index) => ({
    ...report,
    id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    status: 'VERIFIED',
  }))
  const user = userEvent.setup()
  await show('/admin/reports?status=VERIFIED&sort=priority&pageSize=10')
  await screen.findByRole('table', { name: 'Reports' })
  expect(requests.at(-1)?.params).toMatchObject({
    status: 'VERIFIED',
    sort: 'priority',
    page: 1,
    pageSize: 10,
  })
  expect(
    screen.queryByRole('group', { name: 'Report order' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Latest' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Priority' }),
  ).not.toBeInTheDocument()
  const input = screen.getByRole('searchbox', { name: 'Search' })
  await user.type(input, 'AC')
  await waitFor(() =>
    expect(requests.at(-1)?.params).toMatchObject({
      q: 'AC',
      sort: 'priority',
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(requests.at(-1)?.params).toMatchObject({
      page: 2,
      sort: 'priority',
    }),
  )
  const table = await screen.findByRole('table', { name: 'Reports' })
  expect(
    within(table).getByRole('link', { name: report.reportNumber }),
  ).toHaveAttribute('href', expect.stringContaining('sort=priority'))
})
