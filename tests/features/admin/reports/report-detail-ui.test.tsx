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
import { reportDetailKey } from '@/features/admin/reports/report-queries'
import {
  reportStatusSchema,
  type ReportDetail,
} from '@/features/admin/reports/report-schema'
import { reportStatusLabels } from '@/features/admin/reports/report-labels'
import { admin, property } from '../settings/fixtures'
import { completedReport, photo, reportDetail, reportPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let report: ReportDetail
let readError: ApiError | undefined
let hold: Promise<void> | undefined
let requests: AxiosRequestConfig[]
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  report = structuredClone(reportDetail)
  readError = undefined
  hold = undefined
  requests = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = admin
    else if (config.url === '/property') data = property
    else if (config.url === `/reports/${reportDetail.id}`) {
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
const section = (name: string) => screen.getByRole('region', { name })

it.each(reportStatusSchema.options)(
  'directly loads %s with nullable details and no workflow controls',
  async (status) => {
    report.status = status
    await show()
    const overview = await screen.findByRole('region', {
      name: 'Report information',
    })
    expect(
      within(overview).getByText(reportStatusLabels[status]),
    ).toBeInTheDocument()
    expect(within(overview).getByText('2 Oct 2026, 01:30')).toBeInTheDocument()
    expect(
      within(overview).getByText(
        (_text, node) => node?.textContent === report.description,
      ),
    ).toHaveClass('whitespace-pre-wrap')
    expect(screen.getByText('No damage photos')).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Review' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Technician assignment' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Work result' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /verify|reject|assign|close report|upload/i,
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Report details',
    )
    expect(document.querySelector('header')).toHaveTextContent('Report details')
    expect(
      within(
        screen.getByRole('navigation', { name: 'Admin navigation' }),
      ).getByRole('link', { name: 'Reports', current: 'page' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }).querySelector('a'),
    ).toHaveAttribute('href', '/admin/reports')
    if (status === 'COMPLETED' || status === 'CLOSED')
      expect(
        within(section('Costs and receipt')).getByText('No cost items'),
      ).toBeInTheDocument()
  },
)

it('shows recorded work, audit identities, grouped attachments and authoritative decimal costs', async () => {
  report = structuredClone(completedReport)
  await show()
  await screen.findByRole('region', { name: 'Work result' })
  expect(
    within(screen.getByRole('main'))
      .getAllByRole('region')
      .map((e) => e.getAttribute('aria-label')),
  ).toEqual([
    'Report information',
    'Damage photos',
    'Review',
    'Technician assignment',
    'Work result',
    'Costs and receipt',
    'Record information',
  ])
  expect(within(section('Review')).getByText('Reviewer')).toBeInTheDocument()
  expect(
    within(section('Technician assignment')).getByText('Assigner'),
  ).toBeInTheDocument()
  expect(
    within(section('Work result')).getByText('Reconnected the cable.'),
  ).toBeInTheDocument()
  expect(
    within(section('Record information')).getByText('Closer'),
  ).toBeInTheDocument()
  expect(
    within(section('Costs and receipt')).getByText('Total cost (IDR): Rp 0,01'),
  ).toBeInTheDocument()
  expect(
    within(section('Costs and receipt')).getAllByText('Rp 0,01'),
  ).toHaveLength(2)
  expect(screen.getByRole('link', { name: /View receipt/ })).toHaveAttribute(
    'href',
    'https://example.test/receipt.pdf',
  )
  expect(screen.getByRole('link', { name: /View receipt/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  expect(screen.getByRole('link', { name: /View receipt/ })).toHaveAttribute(
    'target',
    '_blank',
  )
  expect(requests.every((r) => r.method === 'get')).toBe(true)
})

it('preserves filters and pagination from either list presentation through the breadcrumb', async () => {
  const user = userEvent.setup()
  const router = await show(
    '/admin/reports?q=AC&status=REPORTED&category=AC&priority=MEDIUM&dateFrom=2026-10-01&dateTo=2026-10-11&page=2&pageSize=50',
  )
  const table = await screen.findByRole('table', { name: 'Reports' })
  const desktop = within(table).getByRole('link', { name: report.reportNumber })
  const mobile = within(
    screen.getByRole('list', { name: 'Reports records' }),
  ).getByRole('link', { name: report.reportNumber })
  expect(mobile.getAttribute('href')).toBe(desktop.getAttribute('href'))
  const originalSearch = router.state.location.search
  await user.click(
    within(table).getByRole('button', {
      name: `Actions for ${report.reportNumber}`,
    }),
  )
  const action = await screen.findByRole('menuitem', { name: 'View detail' })
  expect(action.getAttribute('href')).toBe(desktop.getAttribute('href'))
  await user.click(action)
  await screen.findByRole('region', { name: 'Report information' })
  expect(router.state.location.search).toEqual(originalSearch)
  await user.click(
    within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole(
      'link',
      { name: 'Reports' },
    ),
  )
  await screen.findByRole('table', { name: 'Reports' })
  expect(router.state.location.search).toEqual(originalSearch)
})

it('uses a keyboard-accessible mobile Actions dropdown with dismissal focus and a clean detail URL', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/reports')
  const records = await screen.findByRole('list', { name: 'Reports records' })
  const trigger = within(records).getByRole('button', {
    name: `Actions for ${report.reportNumber}`,
  })
  trigger.focus()
  await user.keyboard('{Enter}')
  const item = await screen.findByRole('menuitem', { name: 'View detail' })
  expect(item).toHaveAttribute('href', `/admin/reports/${report.id}`)
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
  )
  expect(trigger).toHaveFocus()
  await user.click(trigger)
  await user.click(await screen.findByRole('menuitem', { name: 'View detail' }))
  await screen.findByRole('region', { name: 'Report information' })
  expect(router.state.location.pathname).toBe(`/admin/reports/${report.id}`)
})

it('shows rejection reasons and dashes for missing optional identities', async () => {
  report = {
    ...reportDetail,
    status: 'REJECTED',
    rejectionReason: 'Duplicate report.',
    createdBy: undefined,
    reportedBy: undefined,
  }
  await show()
  expect(await screen.findByText('Duplicate report.')).toBeInTheDocument()
  expect(
    within(section('Report information')).getAllByText('—').length,
  ).toBeGreaterThanOrEqual(3)
})

it('opens a photo with keyboard, dismisses with Escape, restores focus and handles broken images', async () => {
  report.damagePhotos = [photo]
  const user = userEvent.setup()
  await show()
  const trigger = await screen.findByRole('button', {
    name: 'View damage photo 1',
  })
  trigger.focus()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
  fireEvent.error(within(dialog).getByRole('img', { name: 'Damage photo 1' }))
  expect(within(dialog).getByText('Image unavailable')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(trigger).toHaveFocus())
  fireEvent.error(within(section('Damage photos')).getByRole('img'))
  expect(
    within(section('Damage photos')).getByText('Image unavailable'),
  ).toBeInTheDocument()
})

it('uses an initial skeleton and handles read failure with retry', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  readError = new ApiError('Read failed.', 'NETWORK_ERROR')
  await show()
  expect(
    await screen.findByRole('region', { name: 'Loading report' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveClass('sr-only')
  await act(async () => {
    release()
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Read failed.')
  readError = undefined
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('region', { name: 'Report information' }),
  ).toBeInTheDocument()
})

it('retains content on background failure but removes it on refreshed 404', async () => {
  await show()
  await screen.findByRole('region', { name: 'Report information' })
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  readError = new ApiError('Refresh failed.', 'NETWORK_ERROR')
  let refresh!: Promise<void>
  await act(async () => {
    refresh = client.refetchQueries({ queryKey: reportDetailKey(report.id) })
  })
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Updating report…',
  )
  expect(section('Report information')).toBeInTheDocument()
  await act(async () => {
    release()
    await refresh
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh failed.')
  expect(section('Report information')).toBeInTheDocument()
  readError = new ApiError('Missing', 'NOT_FOUND', 404)
  await act(() =>
    client.refetchQueries({ queryKey: reportDetailKey(report.id) }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Report not found')
  expect(
    screen.queryByRole('region', { name: 'Report information' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Try again' }),
  ).not.toBeInTheDocument()
})

it('does not request invalid UUIDs and renders initial not-found recovery', async () => {
  const router = await show('/admin/reports/invalid')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid report ID',
  )
  expect(requests.some((r) => r.url?.startsWith('/reports'))).toBe(false)
  readError = new ApiError('Missing', 'NOT_FOUND', 404)
  await act(() =>
    router.navigate({
      to: '/admin/reports/$reportId',
      params: { reportId: report.id },
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Report not found')
})
