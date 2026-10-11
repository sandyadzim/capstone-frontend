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
import { accountsKey } from '@/features/admin/accounts/account-queries'
import {
  accountsSearchSchema,
  type Account,
} from '@/features/admin/accounts/account-schema'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import { admin, property } from '../settings/fixtures'
import { account, accountPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let accounts: Account[]
let requests: AxiosRequestConfig[]
let readError: ApiError | undefined
let pendingRead: Promise<void> | undefined

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  useAdminUiStore.setState({ collapsed: false })
  client = createQueryClient()
  accounts = [
    { ...account },
    {
      ...account,
      id: '33000000-0000-4000-8000-000000000004',
      name: 'Blair Resident',
      loginIdentifier: 'blair@example.test',
      isActive: false,
      activeUnit: null,
    },
    {
      ...account,
      id: '33000000-0000-4000-8000-000000000002',
      name: 'Chris Technician',
      loginIdentifier: 'chris@example.test',
      role: 'TECHNICIAN',
      activeUnit: null,
    },
    { ...account, ...admin, activeUnit: null },
  ]
  requests = []
  readError = undefined
  pendingRead = undefined
  apiClient.defaults.adapter = async (config) => {
    let data: unknown
    if (config.url === '/auth/me') data = admin
    else if (config.url === '/property') data = property
    else if (config.url === '/accounts' && config.method === 'get') {
      requests.push(config)
      if (pendingRead) await pendingRead
      if (readError) throw readError
      const {
        q = '',
        role,
        isActive,
        page = 1,
        pageSize = 20,
      } = config.params ?? {}
      const filtered = accounts.filter(
        (value) =>
          (!role || value.role === role) &&
          (isActive === undefined ||
            value.isActive === (isActive === 'true')) &&
          (value.name.toLowerCase().includes(q.toLowerCase()) ||
            value.loginIdentifier.toLowerCase().includes(q.toLowerCase())),
      )
      data = accountPage(
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

async function show(path = '/admin/accounts', actor = admin) {
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

it.each([
  [undefined, 'All accounts', ['Name', 'Login ID', 'Role', 'Status', 'Unit']],
  ['RESIDENT', 'Residents', ['Name', 'Login ID', 'Status', 'Unit']],
  ['TECHNICIAN', 'Technicians', ['Name', 'Login ID', 'Status']],
  ['ADMIN', 'Administrators', ['Name', 'Login ID', 'Status']],
] as const)(
  'loads the %s view with matching desktop and mobile fields and a creation link',
  async (role, title, headers) => {
    await show(role ? `/admin/accounts?role=${role}` : '/admin/accounts')
    const table = await screen.findByRole('table', { name: title })
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([...headers, 'Actions'])
    expect(requests.at(-1)?.params).toMatchObject({
      role,
      page: 1,
      pageSize: 20,
    })
    expect(requests.at(-1)?.params.isActive).toBeUndefined()
    const mobile = screen.getByRole('list', { name: `${title} records` })
    for (const record of within(mobile).getAllByRole('listitem')) {
      expect(
        [...record.querySelectorAll('dt')].map((label) => label.textContent),
      ).toEqual(headers)
    }
    expect(within(table).getAllByRole('link').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: 'Create account' }),
    ).toHaveAttribute('href', expect.stringContaining('/admin/accounts/new'))
    expect(
      screen.queryByRole('button', { name: /edit|deactivate/i }),
    ).not.toBeInTheDocument()
  },
)

it('shows resident placement, no unit, and non-resident placeholders', async () => {
  await show()
  const table = await screen.findByRole('table', { name: 'All accounts' })
  expect(within(table).getByText('B-202')).toBeInTheDocument()
  expect(within(table).getByText('No unit')).toBeInTheDocument()
  expect(within(table).getAllByText('—')).toHaveLength(2)
  expect(within(table).getByText('Inactive')).toBeInTheDocument()
})

it('debounces a typing burst, searches login IDs, resets the page and clears immediately with focus retained', async () => {
  const user = userEvent.setup()
  const router = await show(
    '/admin/accounts?role=RESIDENT&page=2&pageSize=10&isActive=true',
  )
  // The supplied page is corrected before search starts.
  await waitFor(() => expect(router.state.location.search.page).toBe(1))
  requests.length = 0
  const search = screen.getByRole('searchbox', { name: 'Search' })
  await user.type(search, 'alex@')
  expect(search).toHaveValue('alex@')
  expect(requests).toHaveLength(0)
  await screen.findByRole('table', { name: 'Residents' })
  await waitFor(() => expect(requests).toHaveLength(1))
  expect(router.state.location.search).toMatchObject({
    q: 'alex@',
    role: 'RESIDENT',
    isActive: 'true',
    page: 1,
    pageSize: 10,
  })
  await waitFor(() =>
    expect(
      within(screen.getByRole('table', { name: 'Residents' })).getByText(
        account.loginIdentifier,
      ),
    ).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  await waitFor(() => expect(router.state.location.search.q).toBe(''))
  expect(search).toHaveFocus()
  expect(router.state.location.search.isActive).toBe('true')
})

it('filters active/inactive accounts and clears status without clearing search or role', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/accounts?role=RESIDENT&q=Resident')
  await screen.findByRole('table', { name: 'Residents' })
  await user.click(screen.getByRole('combobox', { name: 'Status' }))
  await user.click(await screen.findByRole('option', { name: 'Inactive' }))
  await waitFor(() => expect(requests.at(-1)?.params.isActive).toBe('false'))
  const table = screen.getByRole('table', { name: 'Residents' })
  expect(within(table).queryByText(account.name)).not.toBeInTheDocument()
  expect(within(table).getByText('Blair Resident')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear status' }))
  await waitFor(() =>
    expect(router.state.location.search.isActive).toBeUndefined(),
  )
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveFocus()
  expect(router.state.location.search).toMatchObject({
    role: 'RESIDENT',
    q: 'Resident',
    page: 1,
  })
})

it('preserves URL filters across page navigation and history, and resets page after changing size', async () => {
  accounts = Array.from({ length: 25 }, (_, index) => ({
    ...account,
    id: `33000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    name: `Resident ${index}`,
  }))
  const user = userEvent.setup()
  const router = await show(
    '/admin/accounts?role=RESIDENT&q=Resident&isActive=true&pageSize=10',
  )
  await screen.findByRole('table', { name: 'Residents' })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(router.state.location.search.page).toBe(2))
  expect(router.state.location.search).toMatchObject({
    role: 'RESIDENT',
    q: 'Resident',
    isActive: 'true',
    pageSize: 10,
  })
  await act(async () => {
    router.history.back()
  })
  await waitFor(() => expect(router.state.location.search.page).toBe(1))
  await act(async () => {
    router.history.forward()
  })
  await waitFor(() => expect(router.state.location.search.page).toBe(2))
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Page size' })).toBeEnabled(),
  )
  await user.click(screen.getByRole('combobox', { name: 'Page size' }))
  await user.click(await screen.findByRole('option', { name: '50' }))
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      page: 1,
      pageSize: 50,
    }),
  )
})

it.each([false, true])(
  'resets all filters when switching role views with collapsed sidebar %s',
  async (collapsed) => {
    useAdminUiStore.setState({ collapsed })
    const user = userEvent.setup()
    const router = await show(
      '/admin/accounts?role=RESIDENT&q=Resident&isActive=false&pageSize=10',
    )
    await screen.findByRole('table', { name: 'Residents' })
    if (collapsed) {
      await user.click(screen.getByRole('button', { name: 'Accounts' }))
      await user.click(
        await screen.findByRole('menuitem', { name: 'Technicians' }),
      )
    } else await user.click(screen.getByRole('link', { name: 'Technicians' }))
    await screen.findByRole('table', { name: 'Technicians' })
    expect(router.state.location.search).toEqual(
      accountsSearchSchema.parse({ role: 'TECHNICIAN' }),
    )
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Select status',
    )
  },
)

it('cancels an uncommitted search when changing role view', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/accounts?role=RESIDENT')
  await screen.findByRole('table', { name: 'Residents' })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
    target: { value: 'uncommitted' },
  })
  await user.click(screen.getByRole('link', { name: 'Technicians' }))
  await screen.findByRole('table', { name: 'Technicians' })
  // Wait through the old debounce window to prove its timer cannot restore the draft.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350))
  })
  expect(router.state.location.search.q).toBe('')
  expect(requests.some((request) => request.params.q === 'uncommitted')).toBe(
    false,
  )
})

it.each([0, 25])(
  'corrects an out-of-range page for total %s',
  async (total) => {
    accounts = Array.from({ length: total }, (_, index) => ({
      ...account,
      id: `33000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    }))
    const router = await show(
      '/admin/accounts?role=RESIDENT&page=99&pageSize=10',
    )
    await waitFor(() =>
      expect(router.state.location.search.page).toBe(total ? 3 : 1),
    )
    expect(requests.at(-1)?.params.page).toBe(total ? 3 : 1)
  },
)

it('announces skeleton loading and keeps existing records during background refresh', async () => {
  let ready!: () => void
  pendingRead = new Promise((resolve) => {
    ready = resolve
  })
  await show()
  expect(screen.getByRole('status')).toHaveTextContent('Loading all accounts…')
  expect(screen.getByRole('status')).toHaveClass('sr-only')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  pendingRead = undefined
  await act(async () => ready())
  const table = await screen.findByRole('table', { name: 'All accounts' })
  pendingRead = new Promise((resolve) => {
    ready = resolve
  })
  await act(async () => {
    void client.invalidateQueries({ queryKey: accountsKey })
  })
  expect(table).toBeInTheDocument()
  expect(await screen.findByText('Updating all accounts…')).toHaveClass(
    'sr-only',
  )
  pendingRead = undefined
  await act(async () => ready())
})

it('shows the backend read error and retries successfully without writes', async () => {
  readError = new ApiError('Account service is unavailable.', 'HTTP_ERROR', 503)
  const user = userEvent.setup()
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Account service is unavailable.',
  )
  readError = undefined
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('table', { name: 'All accounts' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each([
  ['/admin/accounts', 'No accounts yet.'],
  ['/admin/accounts?role=TECHNICIAN', 'No technicians yet.'],
  ['/admin/accounts?q=missing', 'No accounts match your filters.'],
  ['/admin/accounts?isActive=false', 'No accounts match your filters.'],
])('distinguishes the empty state at %s', async (path, message) => {
  accounts = []
  await show(path)
  expect(await screen.findByText(message)).toBeInTheDocument()
})

it.each(['RESIDENT', 'TECHNICIAN'] as const)(
  'blocks account reads from the %s portal role',
  async (role) => {
    await show('/admin/accounts', { ...admin, role })
    await screen.findByRole('heading', { name: 'Access denied' })
    expect(requests).toHaveLength(0)
  },
)

it('expires the shared session when an account list returns 401', async () => {
  readError = new ApiError('Session expired.', 'UNAUTHORIZED', 401)
  await show()
  await screen.findByRole('heading', { name: 'Sign in' })
  await waitFor(() =>
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: accountsKey })
        .every((query) => query.state.data === undefined),
    ).toBe(true),
  )
})
