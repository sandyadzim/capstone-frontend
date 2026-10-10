// @vitest-environment jsdom
import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { sessionKey, sessionQueryOptions } from '@/features/auth/auth-session'
import { toast } from '@/components/ui/toast'
import type { Actor } from '@/features/auth/auth-schema'
import { property } from '../admin/settings/fixtures'

const admin: Actor = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test Administrator',
  loginIdentifier: 'admin',
  role: 'ADMIN',
}
const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
})
afterEach(() => {
  toast.close()
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})
async function show(path = '/login', actor: Actor | null | undefined = null) {
  if (actor !== undefined) client.setQueryData(sessionKey, actor)
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
function responseAdapter(actor = admin) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data: config.url === '/property' ? property : actor,
    status: config.url === '/auth/logout' ? 204 : 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = adapter
  return adapter
}
async function credentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Login ID'), '  admin  ')
  await user.type(
    screen.getByLabelText('Password', { exact: true }),
    ' password ',
  )
}

it('validates before sending, supports password visibility and Enter, then returns to the full requested address', async () => {
  const adapter = responseAdapter()
  const user = userEvent.setup()
  const router = await show(
    '/login?redirect=%2Fadmin%2Fexamples%2Fform%3Ffrom%3Dlogin%23request',
  )
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Enter your login ID.')).toBeVisible()
  expect(screen.getByLabelText('Login ID')).toHaveFocus()
  expect(adapter).not.toHaveBeenCalled()
  await credentials(user)
  expect(screen.getByLabelText('Login ID')).toHaveAttribute(
    'autocomplete',
    'username',
  )
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  )
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await user.click(screen.getByRole('button', { name: 'Hide password' }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute(
    'type',
    'password',
  )
  await user.click(screen.getByLabelText('Password', { exact: true }))
  await user.keyboard('{Enter}')
  await screen.findByRole('heading', { name: 'Maintenance request' })
  expect(router.state.location.href).toBe(
    '/admin/examples/form?from=login#request',
  )
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    loginIdentifier: 'admin',
    password: ' password ',
  })
})
it('announces generic credential errors, clears password, without stealing focus', async () => {
  apiClient.defaults.adapter = async () => {
    throw new ApiError('Unknown identifier', 'UNAUTHORIZED', 401)
  }
  const user = userEvent.setup()
  await show()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(
    await screen.findByText('Your login ID or password is incorrect.', {
      selector: '[data-slot=toast-description]',
    }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus()
  const close = screen.getByLabelText('Close toast')
  act(() => close.focus())
  await user.keyboard('{Enter}')
  await waitFor(() =>
    expect(
      screen.queryByText('Your login ID or password is incorrect.', {
        selector: '[data-slot=toast-description]',
      }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
  expect(screen.getByLabelText('Login ID')).toHaveValue('  admin  ')
})
it('disables duplicate submission during login and does not render the portal until verification completes', async () => {
  let finish: (() => void) | undefined
  let resolveCheck: (() => void) | undefined
  const adapter = vi.fn<AxiosAdapter>(
    (config) =>
      new Promise<AxiosResponse>((resolve) => {
        const complete = () =>
          resolve({
            data: admin,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          })
        if (config.url === '/auth/login') finish = complete
        else resolveCheck = complete
      }),
  )
  apiClient.defaults.adapter = adapter
  const user = userEvent.setup()
  await show()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  const pending = await screen.findByRole('button', { name: 'Signing in…' })
  expect(pending).toBeDisabled()
  await user.click(pending)
  expect(adapter).toHaveBeenCalledOnce()
  await act(async () => {
    finish?.()
  })
  await waitFor(() => expect(resolveCheck).toBeDefined())
  expect(
    screen.queryByRole('heading', { name: 'Dashboard' }),
  ).not.toBeInTheDocument()
  expect(pending).toBeDisabled()
  await act(async () => {
    resolveCheck?.()
  })
  await screen.findByRole('heading', { name: 'Dashboard' })
})
it('offers a session-only retry when login succeeds but /me is temporarily unreachable', async () => {
  let first = true
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (config.url === '/auth/me' && first) {
      first = false
      throw new ApiError('Offline', 'NETWORK_ERROR')
    }
    return { data: admin, status: 200, statusText: 'OK', headers: {}, config }
  })
  apiClient.defaults.adapter = adapter
  const user = userEvent.setup()
  await show()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(
    'Unable to verify your session. Try checking it again.',
    { selector: '[data-slot=toast-description]' },
  )
  await user.click(screen.getByRole('button', { name: 'Check session again' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
  expect(
    adapter.mock.calls
      .map(([config]) => config.url)
      .filter((url) => url?.startsWith('/auth/')),
  ).toEqual(['/auth/login', '/auth/me', '/auth/me'])
})
it('redirects guests with the original path/query/hash and existing sessions to their home', async () => {
  const router = await show('/technician/examples/form?from=notification#form')
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(router.state.location.search).toMatchObject({
    redirect: '/technician/examples/form?from=notification#form',
  })
})
it.each(['ADMIN', 'TECHNICIAN', 'RESIDENT'] as const)(
  'renders only the permitted portal and account identity for %s',
  async (role) => {
    const actor = { ...admin, role }
    const path = { ADMIN: '/admin', TECHNICIAN: '/technician', RESIDENT: '/' }[
      role
    ]
    const user = userEvent.setup()
    await show(path, actor)
    await user.click(
      await screen.findByRole('button', {
        name: `Account menu for ${actor.name}`,
      }),
    )
    expect(await screen.findByText(actor.name)).toBeVisible()
    expect(screen.getByText(role.toLowerCase(), { exact: true })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
  },
)
it('keeps forbidden portal content hidden and returns to the correct portal', async () => {
  const user = userEvent.setup()
  const router = await show('/technician', admin)
  expect(
    await screen.findByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: `Account menu for ${admin.name}` }),
  ).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/technician')
  await user.click(screen.getByRole('link', { name: 'Go to your portal' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
})
it('preserves the session on logout failure, then retries and sends the user to login', async () => {
  const adapter = responseAdapter()
  const respond = adapter.getMockImplementation()!
  let failLogout = true
  adapter.mockImplementation(async (config) => {
    if (config.url === '/auth/logout' && failLogout) {
      failLogout = false
      throw new ApiError('Offline', 'NETWORK_ERROR')
    }
    return respond(config)
  })
  const user = userEvent.setup()
  const router = await show('/admin', admin)
  await user.click(
    await screen.findByRole('button', {
      name: `Account menu for ${admin.name}`,
    }),
  )
  await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
  expect(
    await screen.findByText(
      'Unable to sign out. Check your connection and try again.',
      { selector: '[data-slot=toast-description]' },
    ),
  ).toBeVisible()
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  await user.click(
    screen.getByRole('menuitem', { name: 'Try signing out again' }),
  )
  await screen.findByRole('heading', { name: 'Sign in' })
  expect(router.state.location.pathname).toBe('/login')
  expect(client.getQueryData(sessionKey)).toBeNull()
})
it('supports sign out from access denied without allowing entry to that portal', async () => {
  responseAdapter()
  const user = userEvent.setup()
  await show('/technician', admin)
  await screen.findByRole('heading', { name: 'Access denied' })
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByRole('heading', { name: 'Sign in' })
})
it('immediately hides the portal on private 401 and shows the expiration reason with its original destination', async () => {
  const router = await show('/admin/examples/form', admin)
  await screen.findByRole('heading', { name: 'Maintenance request' })
  await act(async () => {
    await client
      .fetchQuery({
        queryKey: ['reports'],
        meta: { requiresAuth: true },
        queryFn: async () => {
          throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
        },
      })
      .catch(() => undefined)
  })
  await screen.findByText('Your session has expired. Sign in again.')
  expect(
    screen.queryByRole('heading', { name: 'Maintenance request' }),
  ).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    redirect: '/admin/examples/form',
    reason: 'expired',
  })
})
it('blocks the portal on session-check network failure and recovers without treating it as logout', async () => {
  await show('/admin', admin)
  await screen.findByRole('heading', { name: 'Dashboard' })
  apiClient.defaults.adapter = async () => {
    throw new ApiError('Offline', 'NETWORK_ERROR')
  }
  await act(async () => {
    await client
      .fetchQuery({ ...sessionQueryOptions(client), staleTime: 0 })
      .catch(() => undefined)
  })
  await screen.findByRole('heading', { name: 'Unable to check your session' })
  expect(
    screen.queryByRole('heading', { name: 'Dashboard' }),
  ).not.toBeInTheDocument()
  expect(client.getQueryData(sessionKey)).toEqual(admin)
  responseAdapter()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
})
it('shows an initial session-check failure with explicit retry and redirects an existing session off login', async () => {
  const adapter = responseAdapter()
  adapter.mockRejectedValueOnce(new ApiError('Offline', 'NETWORK_ERROR'))
  client.removeQueries({ queryKey: sessionKey })
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: ['/login'] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await act(() => router.load())
  await screen.findByRole('heading', { name: 'Unable to check your session' })
  expect(adapter).toHaveBeenCalledOnce()
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
})

it('recovers an initial guard failure when focus rechecking finds a valid session', async () => {
  const adapter = responseAdapter()
  adapter.mockRejectedValueOnce(new ApiError('Offline', 'NETWORK_ERROR'))
  client.removeQueries({ queryKey: sessionKey })
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await act(() => router.load())
  await screen.findByRole('heading', { name: 'Unable to check your session' })
  await act(async () => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  await screen.findByRole('heading', { name: 'Dashboard' })
  expect(
    adapter.mock.calls.filter(([config]) => config.url === '/auth/me'),
  ).toHaveLength(2)
  focusManager.setFocused(undefined)
})

it('shows the expiration toast when opening login directly and does not duplicate it on re-render', async () => {
  const user = userEvent.setup()
  await show('/login?reason=expired')
  expect(
    await screen.findByText('Your session has expired. Sign in again.', {
      selector: '[data-slot=toast-description]',
    }),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  expect(
    screen.getAllByText('Your session has expired. Sign in again.', {
      selector: '[data-slot=toast-description]',
    }),
  ).toHaveLength(1)
})

it.each([
  ['Login ID', 254, 'Keep your login ID to 254 characters or fewer.'],
  ['Password', 1024, 'Keep your password to 1,024 characters or fewer.'],
])(
  'validates %s length on paste and clears the error while editing, before submit',
  async (label, limit, message) => {
    const adapter = responseAdapter()
    const user = userEvent.setup()
    await show()
    const input = screen.getByLabelText(label, { exact: true })
    await user.click(input)
    await user.paste('a'.repeat(limit + 1))
    expect(await screen.findByText(message)).toBeVisible()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(message)
    expect(input).toHaveFocus()
    expect(adapter).not.toHaveBeenCalled()
    await user.keyboard('{Backspace}')
    await waitFor(() =>
      expect(screen.queryByText(message)).not.toBeInTheDocument(),
    )
    expect(input).toHaveValue('a'.repeat(limit))
    expect(input).toHaveAttribute('aria-invalid', 'false')
    await user.keyboard('b')
    expect(await screen.findByText(message)).toBeVisible()
    expect(adapter).not.toHaveBeenCalled()
  },
)
