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
import { toast } from '@/components/ui/toast'
import { sessionKey } from '@/features/auth/auth-session'
import {
  accountsKey,
  accountDetailKey,
} from '@/features/admin/accounts/account-queries'
import type { Account } from '@/features/admin/accounts/account-schema'
import type { Actor } from '@/features/auth/auth-schema'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import { admin, property } from '../settings/fixtures'
import { account, accountPage } from './fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let current: Account
let actor: Actor | null
let writes: AxiosRequestConfig[]
let reads: AxiosRequestConfig[]
let readFailure: ApiError | undefined
let writeFailure: ApiError | undefined
let pendingRead: Promise<void> | undefined
let pendingWrite: Promise<void> | undefined

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  useAdminUiStore.setState({ collapsed: false })
  client = createQueryClient()
  current = { ...account }
  actor = admin
  writes = []
  reads = []
  readFailure = undefined
  writeFailure = undefined
  pendingRead = undefined
  pendingWrite = undefined
  apiClient.defaults.adapter = async (config) => {
    let data: unknown
    if (config.url === '/auth/me') {
      if (!actor) throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
      data = actor
    } else if (config.url === '/property') data = property
    else if (config.url === '/accounts') data = accountPage([current], 1, 20, 1)
    else if (config.url?.startsWith('/accounts/')) {
      if (config.method === 'get') {
        reads.push(config)
        if (pendingRead) await pendingRead
        if (readFailure) throw readFailure
        data = { ...current }
      } else {
        writes.push(config)
        if (pendingWrite) await pendingWrite
        if (writeFailure) throw writeFailure
        const values = config.data
          ? JSON.parse(config.data)
          : { isActive: false }
        current = {
          ...current,
          ...values,
          activeUnit:
            values.isActive === false ||
            (values.role && values.role !== 'RESIDENT')
              ? null
              : current.activeUnit,
        }
        if (actor?.id === current.id) {
          if (values.password) actor = null
          else
            actor = {
              id: current.id,
              name: current.name,
              loginIdentifier: current.loginIdentifier,
              role: current.role,
            }
        }
        data = { ...current }
      }
    } else throw new Error(`Unexpected fixture request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = original
  toast.close()
})

async function show(
  path = `/admin/accounts/${current.id}`,
  session: Actor | null = admin,
) {
  client.setQueryData(sessionKey, session)
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
async function openActions(item: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

it.each(['ADMIN', 'TECHNICIAN', 'RESIDENT'] as const)(
  'shows %s account details independently of the source role',
  async (role) => {
    current = {
      ...account,
      role,
      activeUnit: role === 'RESIDENT' ? account.activeUnit : null,
    }
    await show(
      `/admin/accounts/${current.id}?role=TECHNICIAN&q=old&pageSize=50&isActive=false`,
    )
    const detail = await screen.findByRole('region', {
      name: 'Account information',
    })
    expect(
      [...detail.querySelectorAll('dt')].map((node) => node.textContent),
    ).toEqual([
      'Name',
      'Login ID',
      'Role',
      'Status',
      ...(role === 'RESIDENT' ? ['Unit'] : []),
      'Created',
      'Updated',
    ])
    expect(within(detail).getByText(current.name)).toBeInTheDocument()
    expect(
      within(detail).getByText(current.loginIdentifier),
    ).toBeInTheDocument()
    if (role === 'RESIDENT')
      expect(
        within(detail).getByRole('link', { name: 'B-202' }),
      ).toHaveAttribute('href', expect.stringContaining('/admin/units/'))
    expect(within(detail).queryByText(/password|hash/i)).not.toBeInTheDocument()
    expect(
      screen
        .getByLabelText('Admin navigation')
        .querySelectorAll('[aria-current="page"]'),
    ).toHaveLength(0)
    expect(
      screen
        .getByLabelText('Breadcrumb')
        .querySelectorAll('[aria-current="page"]'),
    ).toHaveLength(1)
    expect(
      within(screen.getByLabelText('Breadcrumb')).getByRole('link', {
        name: 'Technicians',
      }),
    ).toHaveAttribute('href', expect.stringContaining('q=old'))
  },
)

it.each([true, false])(
  'shows a hyphen for an unassigned resident with active=%s and no placement guidance',
  async (isActive) => {
    current = { ...current, isActive, activeUnit: null }
    await show()
    const detail = await screen.findByRole('region', {
      name: 'Account information',
    })
    const unit = within(detail).getByText('Unit').parentElement!
    expect(unit.querySelector('dd')).toHaveTextContent(/^-$/)
    expect(detail).not.toHaveTextContent(
      /Unit management|Place this resident|Activate this resident/,
    )
  },
)

it.each(['detail', 'edit'] as const)(
  'shows an invalid ID without fetching a %s account',
  async (page) => {
    await show(`/admin/accounts/invalid${page === 'edit' ? '/edit' : ''}`)
    expect(
      await screen.findByRole('heading', { name: 'Invalid account ID' }),
    ).toBeInTheDocument()
    expect(reads).toHaveLength(0)
    expect(writes).toHaveLength(0)
  },
)

it.each(['detail', 'edit'] as const)(
  'shows account not found on the %s route',
  async (page) => {
    readFailure = new ApiError('Not Found', 'NOT_FOUND', 404)
    await show(`/admin/accounts/${current.id}${page === 'edit' ? '/edit' : ''}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account not found',
    )
    expect(
      screen.queryByRole('button', { name: 'Save changes' }),
    ).not.toBeInTheDocument()
  },
)

it('shows a skeleton, then a readable account, and retries a read failure', async () => {
  let release!: () => void
  pendingRead = new Promise<void>((resolve) => {
    release = resolve
  })
  await show()
  expect(
    await screen.findByRole('region', { name: 'Loading account' }),
  ).toHaveAttribute('aria-busy', 'true')
  readFailure = new ApiError('Read failed', 'INTERNAL_ERROR', 500)
  await act(async () => {
    pendingRead = undefined
    release()
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Read failed')
  readFailure = undefined
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('region', { name: 'Account information' }),
  ).toBeInTheDocument()
})

it('loads edit values from the account, omits unchanged fields and returns with the source query', async () => {
  const search = '?role=TECHNICIAN&q=old&isActive=false&page=3&pageSize=50'
  const router = await show(`/admin/accounts/${current.id}/edit${search}`)
  expect(await screen.findByLabelText('Name')).toHaveValue(account.name)
  expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent(
    'Resident',
  )
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(screen.queryByLabelText('Active account')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: '  New Name  ' },
  })
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/admin/accounts/${account.id}`,
    ),
  )
  expect(JSON.parse(writes[0].data)).toEqual({ name: 'New Name' })
  expect(router.state.location.search).toMatchObject({
    role: 'TECHNICIAN',
    q: 'old',
    isActive: 'false',
    page: 3,
    pageSize: 50,
  })
})

it('keeps a draft and its baseline stable through refresh and Cancel returns to detail', async () => {
  const router = await show(
    `/admin/accounts/${current.id}/edit?role=RESIDENT&q=old&pageSize=50`,
  )
  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'Draft name' },
  })
  current = { ...current, loginIdentifier: 'external-change' }
  await act(async () => {
    await client.invalidateQueries({ queryKey: accountsKey })
  })
  expect(screen.getByLabelText('Name')).toHaveValue('Draft name')
  expect(screen.getByLabelText('Login ID')).toHaveValue(account.loginIdentifier)
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(JSON.parse(writes[0].data)).toEqual({ name: 'Draft name' })
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/admin/accounts/${account.id}`,
    ),
  )
  await userEvent.setup().click(screen.getByRole('link', { name: 'Edit' }))
  await screen.findByLabelText('Name')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/admin/accounts/${account.id}`,
    ),
  )
  expect(router.state.location.search.q).toBe('old')
})

it('requires confirmation before a role change releases an assigned resident', async () => {
  await show(`/admin/accounts/${current.id}/edit`)
  await screen.findByLabelText('Name')
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Role' }))
  await user.click(await screen.findByRole('option', { name: 'Technician' }))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Change resident role?',
  })
  expect(dialog).toHaveTextContent('B-202')
  expect(writes).toHaveLength(0)
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^(Activate |Deactivate |Change password for |Change resident role)/,
      }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Save changes' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await user.click(
    within(
      await screen.findByRole('dialog', {
        name: /^(Activate |Deactivate |Change password for |Change resident role)/,
      }),
    ).getByRole('button', {
      name: 'Save changes',
    }),
  )
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(JSON.parse(writes[0].data)).toEqual({ role: 'TECHNICIAN' })
})

it('retains an edit draft and maps a duplicate Login ID error to its field', async () => {
  writeFailure = new ApiError(
    'Login identifier is already in use',
    'CONFLICT',
    409,
  )
  await show(`/admin/accounts/${current.id}/edit`)
  fireEvent.change(await screen.findByLabelText('Login ID'), {
    target: { value: 'duplicate' },
  })
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Save changes' }))
  expect(
    await screen.findByText('This login ID is already in use. Choose another.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Login ID')).toHaveValue('duplicate')
  expect(screen.getByLabelText('Login ID')).toHaveFocus()
})

it('focuses a field error after closing the resident role confirmation', async () => {
  writeFailure = new ApiError(
    'Login identifier is already in use',
    'CONFLICT',
    409,
  )
  await show(`/admin/accounts/${current.id}/edit`)
  fireEvent.change(await screen.findByLabelText('Login ID'), {
    target: { value: 'duplicate' },
  })
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Role' }))
  await user.click(await screen.findByRole('option', { name: 'Technician' }))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Change resident role?',
  })
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await screen.findByText('This login ID is already in use. Choose another.')
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Change resident role?' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByLabelText('Login ID')).toHaveFocus()
  expect(screen.getByLabelText('Login ID')).toHaveValue('duplicate')
  expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent(
    'Technician',
  )
})

it.each(['activate', 'deactivate'] as const)(
  'confirms %s and uses the appropriate endpoint',
  async (action) => {
    current = {
      ...current,
      isActive: action === 'deactivate',
      activeUnit: action === 'deactivate' ? account.activeUnit : null,
    }
    await show()
    await screen.findByRole('region', { name: 'Account information' })
    await openActions(action === 'activate' ? 'Activate' : 'Deactivate')
    const dialog = await screen.findByRole('dialog', {
      name: /^(Activate |Deactivate |Change password for |Change resident role)/,
    })
    if (action === 'deactivate')
      expect(dialog).toHaveTextContent('released from B-202')
    else expect(dialog).toHaveTextContent('placement will not be restored')
    expect(writes).toHaveLength(0)
    await userEvent.setup().click(
      within(dialog).getByRole('button', {
        name: action === 'activate' ? 'Activate account' : 'Deactivate account',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /^(Activate |Deactivate |Change password for |Change resident role)/,
        }),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.getByRole('heading', { name: 'Account details' }),
    ).toHaveFocus()
    expect(writes).toHaveLength(1)
    expect(writes[0].method).toBe(action === 'activate' ? 'patch' : 'post')
    if (action === 'activate')
      expect(JSON.parse(writes[0].data)).toEqual({ isActive: true })
    else expect(writes[0].url).toMatch(/\/deactivate$/)
  },
)

it('locks pending status confirmation, prevents another write and preserves a conflict for retry', async () => {
  let release!: () => void
  pendingWrite = new Promise<void>((resolve) => {
    release = resolve
  })
  writeFailure = new ApiError(
    'Resolve assigned work before changing this active Technician account',
    'CONFLICT',
    409,
  )
  current = { ...current, role: 'TECHNICIAN', activeUnit: null }
  await show()
  await screen.findByRole('region', { name: 'Account information' })
  await openActions('Deactivate')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Deactivate account' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('dialog', {
      name: /^(Activate |Deactivate |Change password for |Change resident role)/,
    }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
  await act(async () => {
    pendingWrite = undefined
    release()
  })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Deactivate account' }),
    ).toBeEnabled(),
  )
  expect(
    screen.getByRole('dialog', {
      name: /^(Activate |Deactivate |Change password for |Change resident role)/,
    }),
  ).toBeInTheDocument()
  expect(writes).toHaveLength(1)
  writeFailure = undefined
  await user.click(screen.getByRole('button', { name: 'Deactivate account' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^(Activate |Deactivate |Change password for |Change resident role)/,
      }),
    ).not.toBeInTheDocument(),
  )
  expect(writes).toHaveLength(2)
})

it.each([4, 30])(
  'changes another account to a %i-character password without submitting confirmation',
  async (length) => {
    await show()
    await screen.findByRole('region', { name: 'Account information' })
    await openActions('Change password')
    const dialog = await screen.findByRole('dialog', {
      name: /^(Activate |Deactivate |Change password for |Change resident role)/,
    })
    const password = 'p'.repeat(length)
    fireEvent.change(within(dialog).getByLabelText('New password'), {
      target: { value: password },
    })
    fireEvent.change(within(dialog).getByLabelText('Confirm password'), {
      target: { value: password },
    })
    await userEvent.setup().click(
      within(dialog).getByRole('button', {
        name: 'Change password',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /^(Activate |Deactivate |Change password for |Change resident role)/,
        }),
      ).not.toBeInTheDocument(),
    )
    expect(JSON.parse(writes[0].data)).toEqual({ password })
    expect(client.getQueryData(sessionKey)).toEqual(admin)
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus()
  },
)

it('validates password and confirmation, preserves a failed draft, and clears it on dismissal', async () => {
  await show()
  await screen.findByRole('region', { name: 'Account information' })
  await openActions('Change password')
  const user = userEvent.setup()
  const password = screen.getByLabelText('New password')
  const confirm = screen.getByLabelText('Confirm password')
  fireEvent.change(password, { target: { value: 'p'.repeat(31) } })
  expect(
    await screen.findByText('Use 30 characters or fewer.'),
  ).toBeInTheDocument()
  fireEvent.change(password, { target: { value: 'pass' } })
  fireEvent.change(confirm, { target: { value: 'different' } })
  await user.click(screen.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByText('Passwords must match.')).toBeInTheDocument()
  expect(writes).toHaveLength(0)
  fireEvent.change(confirm, { target: { value: 'pass' } })
  writeFailure = new ApiError('Write failed', 'INTERNAL_ERROR', 500)
  await user.click(screen.getByRole('button', { name: 'Change password' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Change password' }),
    ).toBeEnabled(),
  )
  expect(password).toHaveValue('pass')
  expect(confirm).toHaveValue('pass')
  await user.click(screen.getByRole('button', { name: 'Show new password' }))
  expect(password).toHaveAttribute('type', 'text')
  expect(confirm).toHaveAttribute('type', 'password')
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: /^(Activate |Deactivate |Change password for |Change resident role)/,
      }),
    ).not.toBeInTheDocument(),
  )
  await openActions('Change password')
  expect(screen.getByLabelText('New password')).toHaveValue('')
  expect(screen.getByLabelText('Confirm password')).toHaveValue('')
  expect(screen.getByLabelText('New password')).toHaveAttribute(
    'type',
    'password',
  )
})

it('protects self-access and redirects a successful self-password change to Login without expiration feedback', async () => {
  current = { ...account, ...admin, activeUnit: null }
  const router = await show()
  await screen.findByRole('region', { name: 'Account information' })
  await userEvent.setup().click(screen.getByRole('link', { name: 'Edit' }))
  await screen.findByLabelText('Name')
  expect(screen.getByRole('combobox', { name: 'Role' })).toBeDisabled()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
  await screen.findByRole('region', { name: 'Account information' })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Actions' }))
  expect(
    await screen.findByRole('menuitem', { name: 'Deactivate' }),
  ).toHaveAttribute('aria-disabled', 'true')
  await userEvent
    .setup()
    .click(screen.getByRole('menuitem', { name: 'Change password' }))
  expect(
    await screen.findByRole('dialog', {
      name: /^(Activate |Deactivate |Change password for |Change resident role)/,
    }),
  ).toHaveTextContent('You will need to sign in again')
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'pass' },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'pass' },
  })
  const feedback = vi.spyOn(toast, 'add')
  const readsBeforePassword = reads.length
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Change password' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(router.state.location.search.redirect).toContain(
    `/admin/accounts/${admin.id}`,
  )
  expect(router.state.location.search.reason).toBeUndefined()
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(reads).toHaveLength(readsBeforePassword)
  expect(
    client
      .getQueryCache()
      .getAll()
      .filter(
        (query) => query.meta?.requiresAuth && query.state.data !== undefined,
      ),
  ).toHaveLength(0)
  expect(feedback).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Password changed', type: 'success' }),
  )
  expect(feedback).not.toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Session expired' }),
  )
})

it.each(['TECHNICIAN', 'RESIDENT', null] as const)(
  'prevents %s access to account management',
  async (role) => {
    const router = await show(
      `/admin/accounts/${current.id}`,
      role ? { ...admin, role } : null,
    )
    if (role)
      expect(
        await screen.findByRole('heading', { name: 'Access denied' }),
      ).toBeInTheDocument()
    else
      await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(reads).toHaveLength(0)
    expect(writes).toHaveLength(0)
  },
)

it.each([undefined, 'RESIDENT', 'TECHNICIAN', 'ADMIN'] as const)(
  'links the %s list names and row actions with their source context',
  async (role) => {
    current = { ...current, role: role ?? 'RESIDENT', activeUnit: null }
    await show(
      `/admin/accounts?${role ? `role=${role}&` : ''}q=alex&isActive=true&pageSize=50`,
    )
    const table = await screen.findByRole('table')
    const name = within(table).getByRole('link', { name: current.name })
    expect(name).toHaveAttribute(
      'href',
      expect.stringContaining(`/admin/accounts/${current.id}`),
    )
    expect(name).toHaveAttribute('href', expect.stringContaining('q=alex'))
    const user = userEvent.setup()
    const trigger = within(table).getByRole('button', {
      name: `Actions for ${current.name}`,
    })
    trigger.focus()
    await user.keyboard('{Enter}')
    for (const [label, suffix] of [
      ['View', ''],
      ['Edit', '/edit'],
    ]) {
      const link = await screen.findByRole('menuitem', { name: label })
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining(`/admin/accounts/${current.id}${suffix}`),
      )
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('pageSize=50'),
      )
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('isActive=%22true%22'),
      )
    }
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(writes).toHaveLength(0)
  },
)

it('removes cached detail controls when a refresh finds the account missing', async () => {
  client.setQueryData(accountDetailKey(current.id), current)
  await show()
  await screen.findByRole('region', { name: 'Account information' })
  readFailure = new ApiError('Not Found', 'NOT_FOUND', 404)
  await act(() => client.invalidateQueries({ queryKey: accountsKey }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Account not found',
  )
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
})

it('keeps a successful edit successful when its subsequent detail refresh fails', async () => {
  const router = await show(`/admin/accounts/${current.id}/edit`)
  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'Saved name' },
  })
  readFailure = new ApiError('Refresh failed', 'INTERNAL_ERROR', 500)
  const feedback = vi.spyOn(toast, 'add')
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/admin/accounts/${current.id}`,
    ),
  )
  expect(feedback).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Account updated', type: 'success' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh failed')
  expect(
    screen.getByRole('region', { name: 'Account information' }),
  ).toHaveTextContent('Saved name')
  expect(writes).toHaveLength(1)
})

it('keeps password controls and dismissal locked during a pending change', async () => {
  let release!: () => void
  pendingWrite = new Promise<void>((resolve) => {
    release = resolve
  })
  await show()
  await screen.findByRole('region', { name: 'Account information' })
  await openActions('Change password')
  const user = userEvent.setup()
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'pass' },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'pass' },
  })
  await user.click(screen.getByRole('button', { name: 'Change password' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(screen.getByLabelText('New password')).toHaveAttribute('readonly')
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Show new password' }),
  ).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('dialog', { name: /Change password for/ }),
  ).toBeInTheDocument()
  await act(async () => {
    pendingWrite = undefined
    release()
  })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /Change password for/ }),
    ).not.toBeInTheDocument(),
  )
  expect(writes).toHaveLength(1)
})

it('restores password focus even while the saved account refresh is still pending', async () => {
  let releaseWrite!: () => void
  pendingWrite = new Promise<void>((resolve) => {
    releaseWrite = resolve
  })
  await show()
  await screen.findByRole('region', { name: 'Account information' })
  await openActions('Change password')
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'pass' },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'pass' },
  })
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Change password' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  let releaseRead!: () => void
  pendingRead = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  await act(async () => {
    pendingWrite = undefined
    releaseWrite()
  })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: /Change password for/ }),
    ).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus(),
  )
  expect(
    screen.getByRole('region', { name: 'Account information' }),
  ).toHaveAttribute('aria-busy', 'true')
  await act(async () => {
    pendingRead = undefined
    releaseRead()
  })
  expect(writes).toHaveLength(1)
})

it('shows required and over-limit edit errors and validates a corrected role on change', async () => {
  current = { ...current, isActive: false, activeUnit: null }
  await show(`/admin/accounts/${current.id}/edit`)
  const name = await screen.findByLabelText('Name')
  const login = screen.getByLabelText('Login ID')
  const user = userEvent.setup()
  fireEvent.change(name, { target: { value: '' } })
  fireEvent.change(login, { target: { value: 'l'.repeat(255) } })
  expect(
    await screen.findByText('Use 254 characters or fewer.'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
  expect(name).toHaveFocus()
  expect(writes).toHaveLength(0)
  fireEvent.change(name, { target: { value: current.name } })
  fireEvent.change(login, { target: { value: current.loginIdentifier } })
  await user.click(screen.getByRole('combobox', { name: 'Role' }))
  await user.click(await screen.findByRole('option', { name: 'Technician' }))
  expect(screen.getByRole('combobox', { name: 'Role' })).toHaveAttribute(
    'aria-invalid',
    'false',
  )
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(JSON.parse(writes[0].data)).toEqual({ role: 'TECHNICIAN' })
})
