// @vitest-environment jsdom
import type { AxiosAdapter } from 'axios'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { sessionKey } from '@/features/auth/auth-session'
import { toast } from '@/components/ui/toast'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import {
  unitsSearchSchema,
  type Unit,
  type ResidentAccount,
} from '@/features/admin/units/unit-schema'
import { admin, property } from '../settings/fixtures'
import {
  historyDetail,
  historyItem,
  resident,
  unit,
  pageData,
} from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let units: Unit[]
let residents: ResidentAccount[]
let writes: { path: string; method: string; body: Record<string, unknown> }[]
let writeError: ApiError | undefined
let readError: ApiError | undefined
let pendingWrite: Promise<void> | undefined
let pendingRead: Promise<void> | undefined
let reportDetail: typeof historyDetail
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  useAdminUiStore.setState({ collapsed: false })
  client = createQueryClient()
  units = [{ ...unit }]
  residents = [{ ...resident }]
  writes = []
  writeError = undefined
  readError = undefined
  pendingWrite = undefined
  pendingRead = undefined
  reportDetail = structuredClone(historyDetail)
  apiClient.defaults.adapter = async (config) => {
    const path = config.url ?? ''
    const method = config.method ?? 'get'
    let data: unknown
    if (path === '/auth/me') data = admin
    else if (path === '/property') data = property
    else if (method !== 'get') {
      const body = config.data ? JSON.parse(config.data) : {}
      writes.push({ path, method, body })
      if (pendingWrite) await pendingWrite
      if (writeError) throw writeError
      if (path === '/units') {
        const created = {
          ...unit,
          ...body,
          id: '55000000-0000-4000-8000-000000000003',
        }
        created.displayStatus = created.maintenanceFlag
          ? 'MAINTENANCE'
          : 'VACANT'
        units.push(created)
        data = created
      } else {
        const target = units.find((value) => path.includes(value.id))!
        if (method === 'patch') Object.assign(target, body)
        else if (path.endsWith('/archive')) target.isArchived = true
        else if (method === 'put')
          target.activeResident = {
            id: resident.id,
            name: resident.name,
            loginIdentifier: resident.loginIdentifier,
          }
        else if (method === 'delete') target.activeResident = null
        target.displayStatus = target.maintenanceFlag
          ? 'MAINTENANCE'
          : target.activeResident
            ? 'OCCUPIED'
            : 'VACANT'
        data = { ...target }
      }
    } else {
      if (
        pendingRead &&
        (path.startsWith('/units/') || path.startsWith('/reports/'))
      )
        await pendingRead
      if (
        readError &&
        (path.startsWith('/units') || path.startsWith('/reports/'))
      )
        throw readError
      const page = Number(config.params?.page ?? 1)
      const size = Number(config.params?.pageSize ?? 20)
      if (path.startsWith('/reports/')) data = reportDetail
      else if (path === '/accounts')
        data = pageData(
          residents.slice((page - 1) * size, page * size),
          page,
          size,
          residents.length,
        )
      else if (path.endsWith('/history'))
        data = pageData([historyItem], page, size)
      else if (path === '/units') {
        const filtered = units.filter(
          (value) =>
            value.isArchived === (config.params?.isArchived === 'true') &&
            (!config.params?.displayStatus ||
              value.displayStatus === config.params.displayStatus) &&
            value.unitNumber
              .toLowerCase()
              .includes(String(config.params?.q ?? '').toLowerCase()),
        )
        data = pageData(
          filtered.slice((page - 1) * size, page * size),
          page,
          size,
          filtered.length,
        )
      } else data = { ...units.find((value) => path === `/units/${value.id}`) }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  toast.close()
  client.clear()
  apiClient.defaults.adapter = original
})
async function show(path = '/admin/units') {
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
it('filters archived records through the URL and resets pagination', async () => {
  units.push({
    ...unit,
    id: '55000000-0000-4000-8000-000000000002',
    unitNumber: 'Z-999',
    isArchived: true,
  })
  const user = userEvent.setup()
  const router = await show()
  const table = await screen.findByRole('table', { name: 'Units' })
  expect(within(table).getByText('A-101')).toBeInTheDocument()
  expect(
    within(table).getByRole('columnheader', { name: 'Archived' }),
  ).toBeVisible()
  expect(within(table).getByText('No')).toBeVisible()
  expect(within(table).getByText('No')).toHaveAttribute('data-slot', 'badge')
  screen.getByRole('combobox', { name: 'Archived' }).focus()
  await user.keyboard('{ArrowDown}')
  const archivedOption = screen.getByRole('option', { name: 'Yes' })
  expect(within(archivedOption).getByText('Yes')).toHaveAttribute(
    'data-slot',
    'badge',
  )
  await user.click(archivedOption)
  expect(
    within(screen.getByRole('combobox', { name: 'Archived' })).getByText('Yes'),
  ).toHaveAttribute('data-slot', 'badge')
  await waitFor(() =>
    expect(unitsSearchSchema.parse(router.state.location.search)).toMatchObject(
      {
        isArchived: true,
        page: 1,
      },
    ),
  )
  await screen.findAllByText('Z-999')
  expect(
    within(screen.getByRole('table', { name: 'Units' })).getByText('Yes'),
  ).toBeVisible()
  expect(
    within(screen.getByRole('table', { name: 'Units' })).getByText('Yes'),
  ).toHaveAttribute('data-slot', 'badge')
  expect(screen.queryByText('A-101')).not.toBeInTheDocument()
  screen.getByRole('combobox', { name: 'Archived' }).focus()
  await user.keyboard('{ArrowDown}')
  await user.click(await screen.findByRole('option', { name: 'No' }))
  await screen.findAllByText('A-101')
})
it('changes pages and page size, and restores them with browser history', async () => {
  units = Array.from({ length: 21 }, (_, index) => ({
    ...unit,
    id: `55000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    unitNumber: `A-${index + 1}`,
  }))
  const user = userEvent.setup()
  const router = await show()
  await screen.findByRole('table', { name: 'Units' })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Go to page 2' }),
    ).toHaveAttribute('aria-current', 'page'),
  )
  expect(router.state.location.pathname).toBe('/admin/units')
  screen.getByRole('combobox', { name: 'Page size' }).focus()
  await user.keyboard('{ArrowDown}')
  await user.click(await screen.findByRole('option', { name: '50' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Go to page 1' }),
    ).toHaveAttribute('aria-current', 'page'),
  )
  expect(unitsSearchSchema.parse(router.state.location.search)).toMatchObject({
    page: 1,
    pageSize: 50,
  })
  act(() => router.history.back())
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Go to page 2' }),
    ).toHaveAttribute('aria-current', 'page'),
  )
})
it('corrects a page that exceeds the refreshed total and handles empty records', async () => {
  const router = await show('/admin/units?page=9')
  await screen.findAllByText('A-101')
  expect(unitsSearchSchema.parse(router.state.location.search).page).toBe(1)
  await act(() =>
    router.navigate({ to: '/admin/units', search: { isArchived: true } }),
  )
  await screen.findByText('No archived units.')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
})
it('creates a trimmed unit with a negative floor and navigates to its detail', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/units/new')
  await user.type(await screen.findByLabelText('Unit Name'), ' B-101 ')
  await user.type(screen.getByLabelText('Floor'), '-1')
  await user.click(screen.getByRole('button', { name: 'Create unit' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
  expect(router.state.location.pathname).toBe(
    '/admin/units/55000000-0000-4000-8000-000000000003',
  )
  expect(writes[0].body).toEqual({
    unitNumber: 'B-101',
    floor: -1,
    maintenanceFlag: false,
  })
})
it('focuses required errors and keeps blank floor from becoming zero', async () => {
  const user = userEvent.setup()
  await show('/admin/units/new')
  await user.click(await screen.findByRole('button', { name: 'Create unit' }))
  expect(await screen.findByText('Enter a unit name.')).toBeVisible()
  expect(screen.getByLabelText('Unit Name')).toHaveFocus()
  expect(screen.getByLabelText('Floor')).toHaveAccessibleDescription(
    'Enter a whole-number floor.',
  )
  expect(writes).toEqual([])
})
it('disables unchanged saves and sends only the edited floor', async () => {
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}/edit`)
  const floor = await screen.findByLabelText('Floor')
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await user.clear(floor)
  await user.type(floor, '0')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
  expect(writes[0].body).toEqual({ floor: 0 })
})
it('maps backend field errors, keeps the draft, and supports retry', async () => {
  writeError = new ApiError('Duplicate unit number', 'VALIDATION_ERROR', 400, {
    issues: [{ path: ['unitNumber'], message: 'Choose another unit number.' }],
  })
  const user = userEvent.setup()
  await show('/admin/units/new')
  await user.type(await screen.findByLabelText('Unit Name'), 'A-101')
  await user.type(screen.getByLabelText('Floor'), '1')
  await user.click(screen.getByRole('button', { name: 'Create unit' }))
  await screen.findByText('Choose another unit number.')
  expect(screen.getByLabelText('Floor')).toHaveValue('1')
  writeError = undefined
  await user.clear(screen.getByLabelText('Unit Name'))
  await user.type(screen.getByLabelText('Unit Name'), 'A-102')
  await user.click(screen.getByRole('button', { name: 'Create unit' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
})
it('requires acknowledgment before moving an already-placed resident', async () => {
  const user = userEvent.setup()
  const router = await show(`/admin/units/${unit.id}/resident?page=2`)
  const table = await screen.findByRole('table', { name: 'Active residents' })
  await user.click(within(table).getByRole('button', { name: /Select Alex/ }))
  expect(screen.getByRole('button', { name: 'Move resident' })).toBeDisabled()
  expect(screen.getByText(/will move from B-202 to A-101/)).toBeVisible()
  await user.click(
    screen.getByRole('checkbox', { name: 'I confirm this resident move.' }),
  )
  await user.click(screen.getByRole('button', { name: 'Move resident' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
  expect(router.state.location.search.page).toBe(2)
  expect(writes[0]).toMatchObject({
    method: 'put',
    path: `/units/${unit.id}/resident`,
    body: { residentUserId: resident.id },
  })
})
it('clears a selection after a placement conflict instead of resubmitting stale state', async () => {
  writeError = new ApiError(
    'Placement changed. Refresh and try again.',
    'CONFLICT',
    409,
  )
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}/resident`)
  await user.click(
    within(
      await screen.findByRole('table', { name: 'Active residents' }),
    ).getByRole('button', { name: /Select Alex/ }),
  )
  await user.click(
    screen.getByRole('checkbox', { name: 'I confirm this resident move.' }),
  )
  await user.click(screen.getByRole('button', { name: 'Move resident' }))
  await screen.findByText('Unable to place resident')
  expect(
    screen.queryByRole('dialog', { name: 'Move Alex Resident in A-101?' }),
  ).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('table', { name: 'Active residents' })).getByRole(
      'button',
      { name: /Select Alex/ },
    ),
  ).toBeEnabled()
  expect(writes).toHaveLength(1)
})
it('confirms release from the menu without deactivating the resident, then allows archive', async () => {
  units[0].activeResident = {
    id: resident.id,
    name: resident.name,
    loginIdentifier: resident.loginIdentifier,
  }
  units[0].displayStatus = 'OCCUPIED'
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}`)
  await user.click(await screen.findByRole('button', { name: 'Actions' }))
  expect(
    await screen.findByRole('menuitem', { name: 'Release resident' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('menuitem', { name: 'Archive unit' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('menuitem', { name: 'Release resident' }))
  expect(writes).toEqual([])
  await user.click(screen.getByRole('button', { name: 'Confirm release' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Confirm release' }),
    ).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  await user.click(
    await screen.findByRole('menuitem', { name: 'Archive unit' }),
  )
  await user.click(screen.getByRole('button', { name: 'Confirm archive' }))
  await screen.findByText(/This unit is archived/)
  expect(writes.map((write) => write.method)).toEqual(['delete', 'post'])
  expect(
    screen.queryByRole('button', { name: 'Actions' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Maintenance history' }),
  ).toBeVisible()
})
it('keeps a unit active after a blocking report archive conflict', async () => {
  writeError = new ApiError(
    'Resolve active reports before archiving.',
    'CONFLICT',
    409,
  )
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}`)
  await user.click(await screen.findByRole('button', { name: 'Actions' }))
  await user.click(
    await screen.findByRole('menuitem', { name: 'Archive unit' }),
  )
  await user.click(screen.getByRole('button', { name: 'Confirm archive' }))
  await screen.findByText('Unable to archive unit')
  expect(screen.queryByText(/This unit is archived/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeEnabled()
})

it('moves keyboard focus from the action menu into confirmations and restores it on cancel or success', async () => {
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}`)
  const trigger = await screen.findByRole('button', { name: 'Actions' })
  trigger.focus()
  await user.keyboard('{Enter}')
  const archive = await screen.findByRole('menuitem', { name: 'Archive unit' })
  archive.focus()
  await user.keyboard('{Enter}')
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Archive A-101?' }),
    ).toHaveFocus(),
  )
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Archive A-101?' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(trigger).toHaveFocus())
  await user.keyboard('{Enter}')
  await user.click(
    await screen.findByRole('menuitem', { name: 'Archive unit' }),
  )
  await user.click(screen.getByRole('button', { name: 'Confirm archive' }))
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Unit Details', level: 1 }),
    ).toHaveFocus(),
  )
})
it.each(['edit', 'resident'])(
  'blocks direct %s routes for archived units',
  async (page) => {
    units[0].isArchived = true
    await show(`/admin/units/${unit.id}/${page}`)
    await screen.findByRole('heading', { name: 'Archived unit', level: 1 })
    expect(
      screen.queryByRole('button', { name: 'Save changes' }),
    ).not.toBeInTheDocument()
    expect(writes).toEqual([])
  },
)
it('shows separate history columns for archived units and opens a filter-preserving detail route', async () => {
  units[0].isArchived = true
  const user = userEvent.setup()
  const router = await show(
    `/admin/units/${unit.id}/history?isArchived=true&historyPageSize=10`,
  )
  const table = await screen.findByRole('table', {
    name: 'Maintenance history',
  })
  for (const label of ['Report ID', 'Report Title', 'Closed Date', 'Actions'])
    expect(
      within(table).getByRole('columnheader', { name: label }),
    ).toBeVisible()
  expect(within(table).getByText('Rp 125.000,50')).toBeInTheDocument()
  expect(within(table).getByText(historyItem.title)).toHaveClass('line-clamp-2')
  expect(
    screen.queryByText('Scroll horizontally to view all columns.'),
  ).not.toBeInTheDocument()
  await user.click(within(table).getByRole('link', { name: 'View Detail' }))
  expect(await screen.findByText('Replaced seal')).toBeVisible()
  const overview = screen.getByRole('region', { name: 'Maintenance report' })
  const status = within(overview).getByText('Status', { selector: 'dt' })
  expect(status.parentElement?.querySelector('dd')).toHaveTextContent('Closed')
  expect(router.state.location.pathname).toBe(
    `/admin/units/${unit.id}/history/${historyItem.id}`,
  )
  expect(router.state.location.search).toMatchObject({
    isArchived: true,
    historyPageSize: 10,
  })
  expect(screen.getByText('No additional notes')).toBeVisible()
  expect(writes).toEqual([])
})
it('shows read errors with retry and recovers without a write', async () => {
  readError = new ApiError('Cannot reach the API.', 'NETWORK_ERROR')
  const user = userEvent.setup()
  await show()
  await screen.findByText('Cannot reach the API.')
  readError = undefined
  pendingWrite = undefined
  pendingRead = undefined
  reportDetail = structuredClone(historyDetail)
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('table', { name: 'Units' })
  expect(writes).toEqual([])
})
it('handles invalid IDs locally and keeps Units navigation selected on child pages', async () => {
  await show('/admin/units/not-a-uuid/edit')
  await screen.findByRole('heading', { name: 'Invalid unit ID', level: 1 })
  expect(screen.getByRole('link', { name: 'Units' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('opens an archived-filter URL directly using unquoted booleans', async () => {
  units[0].isArchived = true
  const router = await show('/admin/units?isArchived=true')
  await screen.findByRole('table', { name: 'Units' })
  expect(screen.getByRole('combobox', { name: 'Archived' })).toHaveTextContent(
    'Yes',
  )
  expect(router.state.location.searchStr).toBe('?isArchived=true')
})

it('cancels the placement dialog before paging and restores the Select trigger', async () => {
  residents = Array.from({ length: 21 }, (_, index) => ({
    ...resident,
    id: `33000000-0000-4000-8000-${String(index + 3).padStart(12, '0')}`,
    name: `Resident ${index + 1}`,
  }))
  const user = userEvent.setup()
  const router = await show(`/admin/units/${unit.id}/resident`)
  const table = await screen.findByRole('table', { name: 'Active residents' })
  const trigger = within(table).getByRole('button', {
    name: 'Select Resident 1 (alex@example.test)',
  })
  await user.click(trigger)
  expect(
    await screen.findByRole('dialog', { name: 'Move Resident 1 in A-101?' }),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(trigger).toHaveFocus())
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Go to page 2' }),
    ).toHaveAttribute('aria-current', 'page'),
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(
    `/admin/units/${unit.id}/resident`,
  )
  expect(router.state.location.search.residentPage).toBe(2)
  expect(writes).toEqual([])
})
it('debounces unit search through the URL, resets pagination and clears only the search field', async () => {
  const adapter = vi.fn(apiClient.defaults.adapter as AxiosAdapter)
  apiClient.defaults.adapter = adapter
  units.push({
    ...unit,
    id: '55000000-0000-4000-8000-000000000002',
    unitNumber: 'B-202',
    isArchived: true,
  })
  const user = userEvent.setup()
  const router = await show('/admin/units?isArchived=true&page=2')
  const input = await screen.findByRole('searchbox', {
    name: 'Search',
  })
  expect(
    screen.queryByRole('button', { name: 'Reset filters' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Clear archived' }),
  ).not.toBeInTheDocument()
  await user.type(input, 'b-202')
  expect(input).toHaveValue('b-202')
  expect(unitsSearchSchema.parse(router.state.location.search).q).toBe('')
  await waitFor(() =>
    expect(unitsSearchSchema.parse(router.state.location.search)).toMatchObject(
      { q: 'b-202', page: 1, isArchived: true },
    ),
  )
  await screen.findAllByText('B-202')
  expect(
    adapter.mock.calls
      .map(([config]) => config)
      .filter((config) => config.url === '/units' && config.params?.q)
      .map((config) => config.params.q),
  ).toEqual(['b-202'])
  await user.clear(input)
  await user.type(input, 'missing')
  await screen.findByText('No units match your filters.')
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  await waitFor(() =>
    expect(unitsSearchSchema.parse(router.state.location.search)).toMatchObject(
      { q: '', page: 1, isArchived: true },
    ),
  )
  expect(input).toHaveFocus()
  await screen.findAllByText('B-202')
})
it('opens a searched list directly and retains the search when returning from detail', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/units?q=a-101&displayStatus=VACANT')
  const table = await screen.findByRole('table', { name: 'Units' })
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('a-101')
  await user.click(
    within(table).getByRole('button', { name: 'Actions for A-101' }),
  )
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
  await user.click(
    within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole(
      'link',
      { name: 'Units' },
    ),
  )
  await screen.findByRole('table', { name: 'Units' })
  expect(router.state.location.search.q).toBe('a-101')
  expect(router.state.location.search.displayStatus).toBe('VACANT')
})

it('filters computed status through the URL and clears only status while retaining search and archive choice', async () => {
  units.push({
    ...unit,
    id: '55000000-0000-4000-8000-000000000002',
    unitNumber: 'A-102',
    isArchived: true,
    maintenanceFlag: true,
    displayStatus: 'MAINTENANCE',
  })
  units.push({
    ...unit,
    id: '55000000-0000-4000-8000-000000000003',
    unitNumber: 'A-103',
    isArchived: true,
  })
  const user = userEvent.setup()
  const router = await show('/admin/units?isArchived=true&q=A-&page=2')
  const status = await screen.findByRole('combobox', { name: 'Status' })
  expect(status).toHaveTextContent('Select status')
  status.focus()
  await user.keyboard('{ArrowDown}')
  const maintenance = await screen.findByRole('option', { name: 'Maintenance' })
  expect(within(maintenance).getByText('Maintenance')).toHaveAttribute(
    'data-slot',
    'badge',
  )
  await user.click(maintenance)
  expect(within(status).getByText('Maintenance')).toHaveAttribute(
    'data-slot',
    'badge',
  )
  await waitFor(() =>
    expect(unitsSearchSchema.parse(router.state.location.search)).toMatchObject(
      { displayStatus: 'MAINTENANCE', page: 1, q: 'A-', isArchived: true },
    ),
  )
  const table = await screen.findByRole('table', { name: 'Units' })
  await waitFor(() =>
    expect(within(table).queryByText('A-103')).not.toBeInTheDocument(),
  )
  expect(within(table).getByText('A-102')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Clear status' }))
  expect(status).toHaveFocus()
  await waitFor(() =>
    expect(unitsSearchSchema.parse(router.state.location.search)).toMatchObject(
      { displayStatus: null, page: 1, q: 'A-', isArchived: true },
    ),
  )
  expect(status).toHaveTextContent('Select status')
  await screen.findAllByText('A-103')
})

it.each([
  {
    state: 'vacant',
    archived: false,
    occupied: false,
    actions: ['View', 'Edit', 'Place resident'],
  },
  {
    state: 'occupied',
    archived: false,
    occupied: true,
    actions: ['View', 'Edit'],
  },
  {
    state: 'archived',
    archived: true,
    occupied: false,
    actions: ['View'],
  },
])(
  'offers only available navigation for a $state unit in the row menu',
  async ({ archived, occupied, actions }) => {
    units[0].isArchived = archived
    units[0].activeResident = occupied
      ? {
          id: resident.id,
          name: resident.name,
          loginIdentifier: resident.loginIdentifier,
        }
      : null
    units[0].displayStatus = occupied ? 'OCCUPIED' : 'VACANT'
    const user = userEvent.setup()
    await show(archived ? '/admin/units?isArchived=true' : '/admin/units')
    const table = await screen.findByRole('table', { name: 'Units' })
    await user.click(
      within(table).getByRole('button', { name: 'Actions for A-101' }),
    )
    const menu = await screen.findByRole('menu', { name: 'Actions for A-101' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(actions)
    const destinations = {
      View: `/admin/units/${unit.id}`,
      Edit: `/admin/units/${unit.id}/edit`,
      'Place resident': `/admin/units/${unit.id}/resident`,
    }
    for (const [name, path] of Object.entries(destinations)) {
      const item = within(menu).queryByRole('menuitem', { name })
      if (item) expect(item.getAttribute('href')?.split('?')[0]).toBe(path)
    }
    expect(writes).toEqual([])
  },
)

it('opens row actions by keyboard, restores focus on Escape, and retains filters when editing', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/units?q=A&displayStatus=VACANT')
  const table = await screen.findByRole('table', { name: 'Units' })
  const trigger = within(table).getByRole('button', {
    name: 'Actions for A-101',
  })
  trigger.focus()
  await user.keyboard('{Enter}')
  await screen.findByRole('menuitem', { name: 'Edit' })
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.keyboard('{Enter}')
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
  await screen.findByLabelText('Unit Name')
  expect(router.state.location.pathname).toBe(`/admin/units/${unit.id}/edit`)
  expect(router.state.location.search).toMatchObject({
    q: 'A',
    displayStatus: 'VACANT',
  })
  expect(writes).toEqual([])
})

it('keeps labeled Unit data and filter-preserving row actions available in mobile records', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/units?q=A&displayStatus=VACANT&pageSize=10')
  const records = await screen.findByRole('list', { name: 'Units records' })
  const record = within(records).getByRole('listitem')
  for (const label of ['Floor', 'Status', 'Archived', 'Resident'])
    expect(within(record).getByText(label, { selector: 'dt' })).toBeVisible()
  expect(within(record).getByText('Vacant')).toHaveAttribute(
    'data-slot',
    'badge',
  )
  expect(within(record).getByText('No')).toHaveAttribute('data-slot', 'badge')
  expect(
    within(record).getByRole('link', { name: 'Unit A-101' }),
  ).toHaveAttribute('href', expect.stringContaining('displayStatus=VACANT'))
  await user.click(
    within(record).getByRole('button', { name: 'Actions for A-101' }),
  )
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
  expect(router.state.location.search).toMatchObject({
    q: 'A',
    displayStatus: 'VACANT',
    pageSize: 10,
  })
  expect(writes).toEqual([])
})

it('shows Create Unit context and returns through breadcrumbs with list filters intact', async () => {
  const user = userEvent.setup()
  const router = await show(
    '/admin/units/new?q=A&displayStatus=VACANT&pageSize=10',
  )
  await screen.findByRole('heading', { name: 'Create Unit', level: 1 })
  expect(
    within(screen.getByRole('banner')).getByText('Create Unit'),
  ).toBeVisible()
  expect(screen.getByLabelText('Unit Name')).toHaveAttribute(
    'placeholder',
    'e.g. A-101',
  )
  const floor = screen.getByLabelText('Floor')
  expect(floor).toHaveAttribute('placeholder', 'e.g. 1')
  expect(floor).not.toHaveAttribute('aria-describedby')
  expect(
    screen.queryByText(/Negative floors are allowed/),
  ).not.toBeInTheDocument()
  const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
  expect(
    within(breadcrumbs).getByRole('link', { name: 'Create Unit' }),
  ).toHaveAttribute('aria-current', 'page')
  await user.click(within(breadcrumbs).getByRole('link', { name: 'Units' }))
  await screen.findByRole('table', { name: 'Units' })
  expect(router.state.location.pathname).toBe('/admin/units')
  expect(router.state.location.search).toMatchObject({
    q: 'A',
    displayStatus: 'VACANT',
    pageSize: 10,
  })
  expect(writes).toEqual([])
})

it('submits the keyboard-controlled Base UI maintenance flag as a boolean', async () => {
  const user = userEvent.setup()
  await show('/admin/units/new')
  await user.type(await screen.findByLabelText('Unit Name'), 'M-101')
  await user.type(screen.getByLabelText('Floor'), '0')
  const checkbox = screen.getByRole('checkbox', { name: 'Under maintenance' })
  expect(checkbox).not.toBeChecked()
  expect(checkbox).toHaveAttribute('data-slot', 'checkbox')
  checkbox.focus()
  await user.keyboard(' ')
  expect(checkbox).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Create unit' }))
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
  expect(writes).toEqual([
    {
      path: '/units',
      method: 'post',
      body: { unitNumber: 'M-101', floor: 0, maintenanceFlag: true },
    },
  ])
})

it.each([
  { suffix: '/edit', title: 'Edit Unit' },
  { suffix: '', title: 'Unit Details' },
])(
  'shows $title context and preserves list state through breadcrumbs',
  async ({ suffix, title }) => {
    const user = userEvent.setup()
    const router = await show(
      `/admin/units/${unit.id}${suffix}?q=A&displayStatus=VACANT&pageSize=10`,
    )
    await screen.findByRole('heading', { name: title, level: 1 })
    expect(within(screen.getByRole('banner')).getByText(title)).toBeVisible()
    const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(
      within(breadcrumbs).getByRole('link', { name: title }),
    ).toHaveAttribute('aria-current', 'page')
    if (!suffix) {
      const card = await screen.findByRole('region', {
        name: 'Unit information',
      })
      for (const label of [
        'Unit Name',
        'Floor',
        'Status',
        'Archived',
        'Resident',
        'Created',
        'Updated',
      ])
        expect(within(card).getByText(label, { selector: 'dt' })).toBeVisible()
      const status = within(card).getByText('Status', {
        selector: 'dt',
      }).parentElement!
      expect(
        within(status).getByText('Vacant', { selector: 'dd span' }),
      ).toHaveAttribute('data-slot', 'badge')
      expect(within(card).getByText('A-101', { selector: 'dd' })).toBeVisible()
      expect(within(card).getByRole('link', { name: 'Edit' })).toBeVisible()
      expect(
        within(card).getByRole('button', { name: 'Actions' }),
      ).toBeVisible()
    } else await screen.findByLabelText('Unit Name')
    await user.click(within(breadcrumbs).getByRole('link', { name: 'Units' }))
    await screen.findByRole('table', { name: 'Units' })
    expect(router.state.location.pathname).toBe('/admin/units')
    expect(router.state.location.search).toMatchObject({
      q: 'A',
      displayStatus: 'VACANT',
      pageSize: 10,
    })
    expect(writes).toEqual([])
  },
)

it.each([
  {
    state: 'vacant',
    archived: false,
    occupied: false,
    items: ['Place resident', 'Maintenance history', 'Archive unit'],
  },
  {
    state: 'occupied',
    archived: false,
    occupied: true,
    items: ['Maintenance history', 'Release resident'],
  },
  { state: 'archived', archived: true, occupied: false, items: [] },
])(
  'keeps the detail footer compact with available actions for a $state unit',
  async ({ archived, occupied, items }) => {
    units[0].isArchived = archived
    units[0].activeResident = occupied
      ? {
          id: resident.id,
          name: resident.name,
          loginIdentifier: resident.loginIdentifier,
        }
      : null
    units[0].displayStatus = occupied ? 'OCCUPIED' : 'VACANT'
    const user = userEvent.setup()
    const router = await show(
      `/admin/units/${unit.id}?q=A&displayStatus=VACANT&pageSize=10`,
    )
    const card = await screen.findByRole('region', { name: 'Unit information' })
    if (archived) {
      expect(within(card).queryByRole('button')).not.toBeInTheDocument()
      expect(within(card).getAllByRole('link')).toHaveLength(1)
      expect(
        within(card).getByRole('link', { name: 'Maintenance history' }),
      ).toHaveAttribute('href', expect.stringContaining('displayStatus=VACANT'))
    } else {
      expect(within(card).getAllByRole('button')).toHaveLength(1)
      expect(within(card).getAllByRole('link')).toHaveLength(1)
      expect(within(card).getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        expect.stringContaining('q=A'),
      )
      const trigger = within(card).getByRole('button', { name: 'Actions' })
      trigger.focus()
      await user.keyboard('{Enter}')
      const menu = await screen.findByRole('menu', { name: 'Unit actions' })
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent?.trim()),
      ).toEqual(items)
      expect(within(menu).getByRole('separator')).toBeVisible()
      expect(
        within(menu).getByRole('menuitem', {
          name: occupied ? 'Release resident' : 'Archive unit',
        }),
      ).toHaveAttribute('data-variant', 'destructive')
      for (const label of ['Place resident', 'Maintenance history']) {
        const item = within(menu).queryByRole('menuitem', { name: label })
        if (item)
          expect(item).toHaveAttribute(
            'href',
            expect.stringContaining('pageSize=10'),
          )
      }
      await user.keyboard('{Escape}')
      await waitFor(() => expect(trigger).toHaveFocus())
      await user.click(trigger)
      await user.click(
        await screen.findByRole('menuitem', { name: 'Maintenance history' }),
      )
      await screen.findByRole('table', { name: 'Maintenance history' })
      expect(router.state.location.pathname).toBe(
        `/admin/units/${unit.id}/history`,
      )
      expect(router.state.location.search).toMatchObject({
        q: 'A',
        displayStatus: 'VACANT',
        pageSize: 10,
      })
    }
    expect(writes).toEqual([])
  },
)

it('disables the detail action menu and edit navigation during a confirmed write', async () => {
  const user = userEvent.setup()
  const router = await show(`/admin/units/${unit.id}`)
  await user.click(await screen.findByRole('button', { name: 'Actions' }))
  await user.click(
    await screen.findByRole('menuitem', { name: 'Archive unit' }),
  )
  let finishWrite: (() => void) | undefined
  pendingWrite = new Promise<void>((resolve) => {
    finishWrite = resolve
  })
  await user.click(screen.getByRole('button', { name: 'Confirm archive' }))
  expect(
    screen.getByRole('button', { name: 'Actions', hidden: true }),
  ).toBeDisabled()
  const edit = screen.getByRole('link', { name: 'Edit', hidden: true })
  expect(edit).toHaveAttribute('aria-disabled', 'true')
  await user.click(edit)
  expect(router.state.location.pathname).toBe(`/admin/units/${unit.id}`)
  expect(screen.getByRole('button', { name: 'Archiving…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Archive A-101?' })).toBeVisible()
  expect(writes).toHaveLength(1)
  await act(async () => {
    finishWrite?.()
  })
  await screen.findByText(/This unit is archived/)
})

it.each([
  { suffix: '/edit', title: 'Edit Unit', ready: 'form' },
  { suffix: '', title: 'Unit Details', ready: 'details' },
  { suffix: '/resident', title: 'Resident Placement', ready: 'residents' },
  { suffix: '/history', title: 'Maintenance History', ready: 'history' },
  {
    suffix: `/history/${historyItem.id}`,
    title: 'History Details',
    ready: 'result',
  },
])(
  'shows an accessible skeleton while $title loads',
  async ({ suffix, title, ready }) => {
    let finishRead: (() => void) | undefined
    pendingRead = new Promise<void>((resolve) => {
      finishRead = resolve
    })
    await show(`/admin/units/${unit.id}${suffix}`)
    expect(
      await screen.findByRole('heading', { name: title, level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Loading unit page' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading unit page…')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => {
      finishRead?.()
    })
    if (ready === 'form') await screen.findByLabelText('Unit Name')
    else if (ready === 'details')
      await screen.findByRole('region', { name: 'Unit information' })
    else if (ready === 'residents')
      await screen.findByRole('table', { name: 'Active residents' })
    else if (ready === 'history')
      await screen.findByRole('table', { name: 'Maintenance history' })
    else await screen.findByText('Replaced seal')
    expect(
      screen.queryByRole('region', { name: 'Loading unit page' }),
    ).not.toBeInTheDocument()
  },
)

it.each(['archive', 'release'] as const)(
  'dismisses the %s dialog with Escape without writing and restores its trigger',
  async (action) => {
    if (action === 'release') {
      units[0].activeResident = {
        id: resident.id,
        name: resident.name,
        loginIdentifier: resident.loginIdentifier,
      }
      units[0].displayStatus = 'OCCUPIED'
    }
    const user = userEvent.setup()
    await show(`/admin/units/${unit.id}`)
    const trigger = await screen.findByRole('button', { name: 'Actions' })
    await user.click(trigger)
    await user.click(
      await screen.findByRole('menuitem', {
        name: action === 'archive' ? 'Archive unit' : 'Release resident',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(within(dialog).getByRole('heading')).toHaveFocus(),
    )
    await user.keyboard('{Tab}')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(writes).toEqual([])
  },
)

it('keeps the placement dialog open during a held write and prevents cancellation or duplicate submission', async () => {
  residents[0].activeUnit = null
  let finishWrite: (() => void) | undefined
  pendingWrite = new Promise<void>((resolve) => {
    finishWrite = resolve
  })
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}/resident`)
  await user.click(
    within(
      await screen.findByRole('table', { name: 'Active residents' }),
    ).getByRole('button', { name: /Select Alex/ }),
  )
  const dialog = await screen.findByRole('dialog', {
    name: 'Place Alex Resident in A-101?',
  })
  await user.click(
    within(dialog).getByRole('button', { name: 'Place resident' }),
  )
  expect(
    within(dialog).getByRole('button', { name: 'Placing…' }),
  ).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(dialog).toBeVisible()
  expect(writes).toHaveLength(1)
  await act(async () => {
    finishWrite?.()
  })
  await screen.findByRole('heading', { name: 'Unit Details', level: 1 })
})

it('loads history detail directly with chronological milestones, work result and a filter-preserving return', async () => {
  const user = userEvent.setup()
  const router = await show(
    `/admin/units/${unit.id}/history/${historyItem.id}?q=A&historyPageSize=10`,
  )
  expect(await screen.findByText('Replaced seal')).toBeVisible()
  expect(
    within(screen.getByRole('banner')).getByText('History Details'),
  ).toBeVisible()
  const timeline = screen.getByRole('list', { name: 'Maintenance timeline' })
  expect(
    within(timeline)
      .getAllByRole('heading')
      .map((heading) => heading.textContent),
  ).toEqual([
    'Report submitted',
    'Technician assigned',
    'Work result recorded',
    'Work result updated',
    'Report closed',
  ])
  const dates = within(timeline)
    .getAllByRole('time')
    .map((time) => time.getAttribute('datetime')!)
  expect(dates.map(Date.parse)).toEqual(
    [...dates].map(Date.parse).sort((a, b) => a - b),
  )
  expect(screen.getByText('No additional notes')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Cost Details' })).toBeVisible()
  const costSection = screen.getByRole('region', { name: 'Cost Details' })
  expect(within(costSection).getByText('Rp 125.000,50')).toBeVisible()
  expect(within(costSection).queryByText(/×/)).not.toBeInTheDocument()
  const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
  await user.click(
    within(breadcrumb).getByRole('link', { name: 'Maintenance History' }),
  )
  await screen.findByRole('table', { name: 'Maintenance history' })
  expect(router.state.location.pathname.replace(/\/$/, '')).toBe(
    `/admin/units/${unit.id}/history`,
  )
  expect(router.state.location.search).toMatchObject({
    q: 'A',
    historyPageSize: 10,
  })
  expect(writes).toEqual([])
})

it('shows honest missing work-result and technician states in history detail', async () => {
  reportDetail.maintenanceResult = null
  reportDetail.assignment = null
  reportDetail.costItems = []
  await show(`/admin/units/${unit.id}/history/${historyItem.id}`)
  expect(await screen.findByText('No work result available.')).toBeVisible()
  expect(screen.getByText('No technician available')).toBeVisible()
  const timeline = screen.getByRole('list', { name: 'Maintenance timeline' })
  expect(
    within(timeline)
      .getAllByRole('heading')
      .map((heading) => heading.textContent),
  ).toEqual(['Report submitted', 'Report closed'])
})

it('rejects a mismatched history detail and supports retry without leaking its result', async () => {
  reportDetail.unit.id = resident.activeUnit!.id
  const user = userEvent.setup()
  await show(`/admin/units/${unit.id}/history/${historyItem.id}`)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This report is not in this unit’s closed maintenance history.',
  )
  expect(screen.queryByText('Replaced seal')).not.toBeInTheDocument()
  reportDetail.unit.id = unit.id
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Replaced seal')).toBeVisible()
})

it.each([
  { suffix: '/resident', title: 'Resident Placement' },
  { suffix: '/history', title: 'Maintenance History' },
])(
  'uses $title consistently and returns to Unit Details through breadcrumbs',
  async ({ suffix, title }) => {
    const user = userEvent.setup()
    const router = await show(
      `/admin/units/${unit.id}${suffix}?q=A&pageSize=10`,
    )
    await screen.findByRole('heading', { name: title, level: 1 })
    expect(within(screen.getByRole('banner')).getByText(title)).toBeVisible()
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    await user.click(
      within(breadcrumb).getByRole('link', { name: 'Unit Details' }),
    )
    await screen.findByRole('region', { name: 'Unit information' })
    expect(router.state.location.pathname).toBe(`/admin/units/${unit.id}`)
    expect(router.state.location.search).toMatchObject({ q: 'A', pageSize: 10 })
  },
)
