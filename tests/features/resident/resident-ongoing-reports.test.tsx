// @vitest-environment jsdom
import type { AxiosRequestConfig } from 'axios'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterContextProvider,
} from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { ResidentOngoingReports } from '@/features/resident/resident-ongoing-reports'
import type { ReportListItem } from '@/features/admin/reports/report-schema'
import { report } from '../admin/reports/fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let records: ReportListItem[]
let total: number
let error: ApiError | undefined
let hold: Promise<void> | undefined
let requests: AxiosRequestConfig[]

beforeEach(() => {
  client = createQueryClient()
  records = [report]
  total = 1
  error = undefined
  hold = undefined
  requests = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    const data = records
    await hold
    if (error) throw error
    return {
      data: {
        data,
        meta: {
          page: 1,
          pageSize: 10,
          total,
          totalPages: Math.ceil(total / 10),
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
})
function content(unitId = report.unit.id) {
  return (
    <QueryClientProvider client={client}>
      <RouterContextProvider
        router={createRouter({
          routeTree,
          context: { queryClient: client },
          history: createMemoryHistory({ initialEntries: ['/'] }),
        })}
      >
        <ResidentOngoingReports actorId="resident" unitId={unitId} />
      </RouterContextProvider>
    </QueryClientProvider>
  )
}

it('uses one filtered request and renders linked summaries with final-before-proposed priority', async () => {
  records = [
    report,
    {
      ...report,
      id: '55000000-0000-4000-8000-000000000002',
      title: 'Kitchen leak',
      status: 'COMPLETED',
      proposedPriority: 'LOW',
      finalPriority: 'HIGH',
    },
  ]
  total = 2
  render(content())
  const list = await screen.findByRole('list', { name: 'Ongoing reports' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(within(list).getByText('Medium')).toBeVisible()
  expect(within(list).getByText('High')).toBeVisible()
  expect(within(list).queryByText('Low')).not.toBeInTheDocument()
  expect(within(list).getByText('Completed')).toBeVisible()
  expect(within(list).getAllByText(/2 Oct 2026, 01:30/)).toHaveLength(2)
  expect(within(list).getAllByRole('link')).toHaveLength(2)
  expect(
    within(list).getByRole('link', { name: `View report: ${report.title}` }),
  ).toHaveAttribute('href', `/reports/${report.id}`)
  expect(within(list).queryByRole('button')).not.toBeInTheDocument()
  expect(within(list).queryByText(report.reportNumber)).not.toBeInTheDocument()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({
    url: '/reports',
    params: { ongoingOnly: true, page: 1, pageSize: 10 },
    withCredentials: true,
  })
})

it('shows API status labels as footer text and reserves badges for priority', async () => {
  const statuses = [
    'REPORTED',
    'VERIFIED',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
  ] as const
  const labels = [
    'Reported',
    'Verified',
    'Assigned',
    'In progress',
    'Completed',
  ]
  records = statuses.map((status, index) => ({
    ...report,
    id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    status,
  }))
  total = records.length
  render(content())
  const list = await screen.findByRole('list', { name: 'Ongoing reports' })
  within(list)
    .getAllByRole('listitem')
    .forEach((card, index) => {
      const status = within(card).getByText('Status:').parentElement
      expect(status).toHaveTextContent(`Status: ${labels[index]}`)
      expect(status).not.toHaveAttribute('data-slot', 'badge')
      const badges = card.querySelectorAll('[data-slot="badge"]')
      expect(badges).toHaveLength(1)
      expect(badges[0]).toHaveTextContent('Medium')
    })
})

it('shows at most ten reports and explains when more exist', async () => {
  records = Array.from({ length: 11 }, (_, index) => ({
    ...report,
    id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  }))
  total = 25
  render(content())
  expect(
    within(
      await screen.findByRole('list', { name: 'Ongoing reports' }),
    ).getAllByRole('listitem'),
  ).toHaveLength(10)
  expect(
    screen.getByText('Showing the latest 10 ongoing reports.'),
  ).toBeVisible()
})

it('shows skeletons until a successful empty response', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  records = []
  total = 0
  render(content())
  expect(
    screen.getByRole('status', { name: 'Loading ongoing reports' }),
  ).toBeVisible()
  expect(screen.queryByText('No ongoing reports')).not.toBeInTheDocument()
  await act(async () => {
    release()
  })
  expect(await screen.findByText('No ongoing reports')).toBeVisible()
})

it('keeps failures distinct from empty results and supports keyboard retry without automatic retry', async () => {
  error = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  render(content())
  expect(
    await screen.findByText('We couldn’t load your ongoing reports.'),
  ).toBeVisible()
  expect(screen.queryByText('No ongoing reports')).not.toBeInTheDocument()
  expect(requests).toHaveLength(1)
  error = undefined
  screen.getByRole('button', { name: 'Retry' }).focus()
  await userEvent.keyboard('{Enter}')
  expect(await screen.findByText(report.title)).toBeVisible()
  expect(requests).toHaveLength(2)
})

it('retains existing records during a failed background refresh', async () => {
  render(content())
  await screen.findByText(report.title)
  error = new ApiError('Unavailable', 'HTTP_ERROR', 503)
  await act(async () => {
    await client.refetchQueries({ queryKey: ['resident', 'reports'] })
  })
  expect(
    await screen.findByText('We couldn’t refresh your ongoing reports.'),
  ).toBeVisible()
  expect(screen.getByText(report.title)).toBeVisible()
})

it('cancels an obsolete unit request and prevents a late response from replacing the new unit', async () => {
  let release!: () => void
  hold = new Promise((resolve) => {
    release = resolve
  })
  const view = render(content())
  await waitFor(() => expect(requests).toHaveLength(1))
  hold = undefined
  records = [{ ...report, title: 'New unit issue' }]
  view.rerender(content('11000000-0000-4000-8000-000000000009'))
  expect(await screen.findByText('New unit issue')).toBeVisible()
  expect(requests[0].signal?.aborted).toBe(true)
  await act(async () => {
    release()
  })
  expect(screen.queryByText(report.title)).not.toBeInTheDocument()
})

it('rejects malformed report data instead of showing it as an empty list', async () => {
  records = [{ ...report, title: '' }]
  render(content())
  expect(
    await screen.findByText('We couldn’t load your ongoing reports.'),
  ).toBeVisible()
  expect(screen.queryByText('No ongoing reports')).not.toBeInTheDocument()
})
