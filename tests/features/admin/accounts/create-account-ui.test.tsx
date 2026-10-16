// @vitest-environment jsdom
import type { AxiosRequestConfig } from 'axios'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'
import { sessionKey } from '@/features/auth/auth-session'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import { admin, property } from '../settings/fixtures'
import { account, accountPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let writes: AxiosRequestConfig[]
let failure: ApiError | undefined
let pending: Promise<void> | undefined

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  useAdminUiStore.setState({ collapsed: false })
  client = createQueryClient()
  writes = []
  failure = undefined
  pending = undefined
  apiClient.defaults.adapter = async (config) => {
    let data: unknown
    if (config.url === '/auth/me') data = admin
    else if (config.url === '/property') data = property
    else if (config.url === '/accounts' && config.method === 'get')
      data = accountPage([])
    else if (config.url === '/accounts' && config.method === 'post') {
      writes.push(config)
      if (pending) await pending
      if (failure) throw failure
      const values = JSON.parse(config.data)
      data = {
        ...account,
        name: values.name,
        loginIdentifier: values.loginIdentifier,
        role: values.role,
        isActive: values.isActive,
        activeUnit: null,
      }
    } else throw new Error(`Unexpected request: ${config.method} ${config.url}`)
    return {
      data,
      status: config.method === 'post' ? 201 : 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
  toast.close()
})

async function show(
  path = '/admin/accounts/new',
  actor: typeof admin | null = admin,
) {
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

function fillIdentity() {
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: ' Alex ' },
  })
  fireEvent.change(screen.getByLabelText('Login ID'), {
    target: { value: ' USER-ALEX ' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: '  password12  ' },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: '  password12  ' },
  })
}

async function chooseRole(label = 'Technician') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Role' }))
  await user.click(await screen.findByRole('option', { name: label }))
}

it.each([
  ['RESIDENT', 'Resident'],
  ['TECHNICIAN', 'Technician'],
  ['ADMIN', 'Administrator'],
] as const)(
  'prefills %s, defaults active even from an inactive list and allows changing Role',
  async (role, label) => {
    await show(`/admin/accounts/new?role=${role}&isActive=false`)
    expect(
      screen.getByRole('heading', { name: 'Create account' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent(
      label,
    )
    expect(
      screen.getByRole('checkbox', { name: 'Active account' }),
    ).toBeChecked()
    await chooseRole(label === 'Technician' ? 'Resident' : 'Technician')
    expect(
      screen.getByRole('combobox', { name: 'Role' }),
    ).not.toHaveTextContent(label)
    expect(screen.queryByLabelText('Unit')).not.toBeInTheDocument()
  },
)

it('requires identity fields, confirmation and a role, focusing the first invalid input', async () => {
  await show()
  expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent(
    'Select role',
  )
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByText('Enter a name.')
  expect(screen.getByText('Enter a login ID.')).toBeInTheDocument()
  expect(screen.getByText('Use at least 4 characters.')).toBeInTheDocument()
  expect(screen.getByText('Confirm the password.')).toBeInTheDocument()
  expect(screen.getByText('Select a role.')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toHaveFocus()
  expect(writes).toHaveLength(0)
})

it('clears a required Role error on selection while focus remains in the field', async () => {
  await show()
  const role = screen.getByRole('combobox', { name: 'Role' })
  fireEvent.blur(role)
  expect(await screen.findByText('Select a role.')).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(role)
  await screen.findByRole('option', { name: 'Resident' })
  await user.keyboard('{ArrowDown}{Enter}')
  await waitFor(() =>
    expect(screen.queryByText('Select a role.')).not.toBeInTheDocument(),
  )
  expect(role).toHaveFocus()
  expect(role).toHaveAttribute('aria-invalid', 'false')
  expect(writes).toHaveLength(0)
})

it.each([4, 30])(
  'submits a %i-character password with local confirmation',
  async (length) => {
    const router = await show('/admin/accounts/new?role=ADMIN')
    fillIdentity()
    const password = 'p'.repeat(length)
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: password },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: password },
    })
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/accounts'),
    )
    expect(JSON.parse(writes[0].data)).toMatchObject({ password })
    expect(JSON.parse(writes[0].data)).not.toHaveProperty('confirmPassword')
  },
)

it('starts a fresh form when the source role changes through URL navigation', async () => {
  const router = await show('/admin/accounts/new?role=RESIDENT')
  fillIdentity()
  await act(() =>
    router.navigate({ to: '/admin/accounts/new', search: { role: 'ADMIN' } }),
  )
  expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent(
    'Administrator',
  )
  expect(screen.getByLabelText('Name')).toHaveValue('')
  expect(screen.getByLabelText('Password')).toHaveValue('')
  await act(() =>
    router.navigate({ to: '/admin/accounts/new', search: { role: undefined } }),
  )
  expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent(
    'Select role',
  )
})

it('redirects guests to sign in before displaying account creation', async () => {
  const router = await show('/admin/accounts/new?role=ADMIN', null)
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(router.state.location.pathname).toBe('/login')
  expect(router.state.location.search.redirect).toContain('/admin/accounts/new')
  expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
  expect(writes).toHaveLength(0)
})

it('revalidates password matching, supports independent visibility and sends an inactive account without placement', async () => {
  const user = userEvent.setup()
  const router = await show(
    '/admin/accounts/new?role=RESIDENT&pageSize=50&q=old&isActive=true',
  )
  fillIdentity()
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'different123' },
  })
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByText('Passwords must match.')
  expect(writes).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: '  password12  ' },
  })
  await waitFor(() =>
    expect(screen.queryByText('Passwords must match.')).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
    'type',
    'password',
  )
  await user.click(
    screen.getByRole('button', { name: 'Show confirm password' }),
  )
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
    'type',
    'text',
  )
  await user.click(screen.getByRole('checkbox', { name: 'Active account' }))
  const feedback = vi.spyOn(toast, 'add')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/accounts'),
  )
  expect(JSON.parse(writes[0].data)).toEqual({
    name: 'Alex',
    loginIdentifier: 'user-alex',
    password: '  password12  ',
    role: 'RESIDENT',
    isActive: false,
  })
  expect(router.state.location.search).toMatchObject({
    role: 'RESIDENT',
    q: '',
    page: 1,
    pageSize: 50,
  })
  expect(router.state.location.search.isActive).toBeUndefined()
  expect(feedback).toHaveBeenCalledWith({
    title: 'Account created',
    type: 'success',
  })
})

it.each([undefined, 'RESIDENT'] as const)(
  'returns to All or the created role from source %s and replaces the form in history',
  async (source) => {
    const user = userEvent.setup()
    const router = await show(
      source
        ? `/admin/accounts?role=${source}&q=old&pageSize=10&isActive=false`
        : '/admin/accounts?q=old&pageSize=10',
    )
    await user.click(
      await screen.findByRole('link', { name: 'Create account' }),
    )
    await screen.findByRole('heading', { name: 'Create account' })
    fillIdentity()
    await chooseRole('Technician')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/accounts'),
    )
    expect(router.state.location.search).toMatchObject({
      q: '',
      page: 1,
      pageSize: 10,
    })
    expect(router.state.location.search.role).toBe(
      source ? 'TECHNICIAN' : undefined,
    )
    expect(router.state.location.search.isActive).toBeUndefined()
    act(() => router.history.back())
    await waitFor(() => expect(router.state.location.search.q).toBe('old'))
    expect(router.state.location.pathname).toBe('/admin/accounts')
  },
)

it.each(['Cancel', 'breadcrumb'] as const)(
  'restores exact source filters via %s',
  async (action) => {
    const router = await show(
      '/admin/accounts/new?role=RESIDENT&q=alex&page=2&pageSize=10&isActive=false',
    )
    const user = userEvent.setup()
    if (action === 'Cancel')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
    else
      await user.click(
        screen
          .getByRole('navigation', { name: 'Breadcrumb' })
          .querySelector('a')!,
      )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/accounts'),
    )
    // The empty fixture list corrects an out-of-range page after navigation.
    expect(router.state.location.search).toMatchObject({
      role: 'RESIDENT',
      q: 'alex',
      pageSize: 10,
      isActive: 'false',
    })
    expect(writes).toHaveLength(0)
  },
)

it('keeps over-limit inputs editable and reports errors immediately before blur', async () => {
  await show('/admin/accounts/new?role=ADMIN')
  for (const [label, length, message] of [
    ['Name', 161, 'Use 160 characters or fewer.'],
    ['Login ID', 255, 'Use 254 characters or fewer.'],
    ['Password', 31, 'Use 30 characters or fewer.'],
  ] as const) {
    const input = screen.getByLabelText(label)
    fireEvent.change(input, { target: { value: 'a'.repeat(length) } })
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(input).toHaveValue('a'.repeat(length))
    fireEvent.change(input, {
      target: { value: label === 'Password' ? 'password1234' : 'valid' },
    })
    await waitFor(() =>
      expect(screen.queryByText(message)).not.toBeInTheDocument(),
    )
  }
})

it('locks fields and actions during creation, prevents duplicate submission and preserves a failed draft for retry', async () => {
  let finish!: () => void
  pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  failure = new ApiError('Cannot reach API', 'NETWORK_ERROR')
  const router = await show('/admin/accounts/new?role=ADMIN')
  fillIdentity()
  const user = userEvent.setup()
  const feedback = vi.spyOn(toast, 'add')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByRole('button', { name: 'Loading…' })
  expect(screen.getByLabelText('Name')).toHaveAttribute('readonly')
  expect(screen.getByRole('combobox', { name: 'Role' })).toBeDisabled()
  expect(
    screen.getByRole('checkbox', { name: 'Active account' }),
  ).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  fireEvent.submit(screen.getByLabelText('Name').closest('form')!)
  await act(async () => {
    finish()
  })
  await waitFor(() =>
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unable to create account',
        type: 'error',
      }),
    ),
  )
  expect(writes).toHaveLength(1)
  expect(screen.getByLabelText('Password')).toHaveValue('  password12  ')
  expect(router.state.location.pathname).toBe('/admin/accounts/new')
  failure = undefined
  pending = undefined
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/accounts'),
  )
  expect(writes).toHaveLength(2)
})

it.each([
  [
    new ApiError('Login identifier is already in use', 'CONFLICT', 409),
    'This login ID is already in use. Choose another.',
    'Login ID',
  ],
  [
    new ApiError('Invalid', 'VALIDATION_ERROR', 400, {
      issues: [{ path: ['name'], message: 'Name rejected' }],
    }),
    'Name rejected',
    'Name',
  ],
] as const)(
  'maps backend errors to inputs with focus and keeps the draft',
  async (error, message, label) => {
    failure = error
    await show('/admin/accounts/new?role=RESIDENT')
    fillIdentity()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText(message)
    expect(screen.getByLabelText(label)).toHaveFocus()
    expect(screen.getByLabelText('Name')).toHaveValue(' Alex ')
    expect(screen.getByLabelText('Password')).toHaveValue('  password12  ')
  },
)

it.each(['RESIDENT', 'TECHNICIAN'] as const)(
  'blocks %s from the creation page',
  async (role) => {
    await show('/admin/accounts/new', { ...admin, role })
    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(writes).toHaveLength(0)
  },
)
