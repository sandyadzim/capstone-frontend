// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  render,
  screen,
  waitFor,
  within,
  fireEvent,
  renderHook,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { sessionKey, expireSession } from '@/features/auth/auth-session'
import { toast } from '@/components/ui/toast'
import {
  propertyQueryKey,
  usePropertySettings,
} from '@/features/admin/settings/hooks/use-property-settings'
import { useAdminUiStore } from '@/features/admin/stores/admin-ui-store'
import { accountsSearchSchema } from '@/features/admin/admin-navigation'
import { admin, property } from './fixtures'

const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let current = { ...property }
let writes: string[]
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    }),
  )
  client = createQueryClient()
  current = { ...property }
  useAdminUiStore.setState({ collapsed: false })
  writes = []
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/auth/me')
      return { data: admin, status: 200, statusText: 'OK', headers: {}, config }
    if (config.method !== 'get') {
      writes.push(config.url ?? '')
      current =
        config.url === '/property/logo'
          ? { ...current, logoUrl: 'https://example.com/logo.png' }
          : { ...current, ...JSON.parse(config.data) }
    }
    return { data: current, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  toast.close()
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})
async function show(
  path = '/admin/settings',
  role: typeof admin.role = 'ADMIN',
) {
  client.setQueryData(sessionKey, { ...admin, role })
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
it('announces loading once and keeps the form unavailable until property data arrives', async () => {
  let resolveRead!: () => void
  const ready = new Promise<void>((resolve) => {
    resolveRead = resolve
  })
  const respond = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/property') await ready
    return respond(config)
  }
  await show()
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading property settings…',
  )
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Admin home' }),
  ).not.toBeInTheDocument()
  await act(async () => resolveRead())
  expect(await screen.findByLabelText('Name')).toHaveValue(property.name)
  expect(
    screen.queryByText('Loading property settings…'),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Admin home' })).toBeInTheDocument()
})
it('loads and submits both validated, trimmed details', async () => {
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  expect(name).toHaveValue(property.name)
  const adapter = vi.fn(apiClient.defaults.adapter as AxiosAdapter)
  apiClient.defaults.adapter = adapter
  await user.clear(name)
  await user.type(name, ' Updated residence ')
  await user.clear(screen.getByLabelText('Address'))
  await user.type(screen.getByLabelText('Address'), ' New address ')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Property details saved')
  const write = adapter.mock.calls.find(([config]) => config.method === 'patch')
  expect(JSON.parse(write?.[0].data)).toEqual({
    name: 'Updated residence',
    address: 'New address',
  })
  expect(writes).toEqual(['/property'])
  expect(
    screen.queryByRole('button', { name: 'Reset' }),
  ).not.toBeInTheDocument()
})
it('shows required errors only after blur and clears them after a valid blur', async () => {
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  expect(name).not.toHaveAttribute('aria-describedby')
  expect(
    screen.queryByText(/Used as your property branding/),
  ).not.toBeInTheDocument()
  await user.clear(name)
  await user.type(name, ' ')
  expect(screen.queryByText('Enter the property name.')).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText('Enter the property name.')).toBeVisible()
  expect(name).toHaveAccessibleDescription('Enter the property name.')
  const address = screen.getByLabelText('Address')
  await user.clear(address)
  await user.type(address, ' ')
  expect(
    screen.queryByText('Enter the property address.'),
  ).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText('Enter the property address.')).toBeVisible()
  await user.click(address)
  await user.clear(address)
  await user.type(address, 'Valid address')
  await user.tab()
  await waitFor(() =>
    expect(
      screen.queryByText('Enter the property address.'),
    ).not.toBeInTheDocument(),
  )
  expect(writes).toEqual([])
})
it('shows and clears the Name length error while typing, preserving over-limit input', async () => {
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  await user.clear(name)
  await user.paste('a'.repeat(161))
  expect(
    await screen.findByText(
      'Keep the property name to 160 characters or fewer.',
    ),
  ).toBeVisible()
  expect(name).toHaveFocus()
  expect(name).toHaveValue('a'.repeat(161))
  expect(name).toHaveAttribute('aria-invalid', 'true')
  await user.keyboard('{Backspace}')
  await waitFor(() =>
    expect(
      screen.queryByText('Keep the property name to 160 characters or fewer.'),
    ).not.toBeInTheDocument(),
  )
  expect(name).toHaveValue('a'.repeat(160))
  expect(name).not.toHaveAttribute('aria-describedby')
  expect(writes).toEqual([])
})
it('validates untouched required fields on submit and focuses the first error', async () => {
  current = { ...property, name: ' ', address: ' ' }
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Enter the property name.')).toBeVisible()
  expect(screen.getByText('Enter the property address.')).toBeVisible()
  expect(name).toHaveFocus()
  expect(writes).toEqual([])
})
it('keeps form input stable through background refreshes and logo saves', async () => {
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  await user.clear(name)
  await user.type(name, 'Unsaved name')
  current = { ...current, name: 'Remote name', address: 'Remote address' }
  await act(() => client.invalidateQueries({ queryKey: propertyQueryKey }))
  expect(name).toHaveValue('Unsaved name')
  expect(screen.getByLabelText('Address')).toHaveValue(property.address)
  await user.upload(
    screen.getByLabelText('Choose a logo'),
    new File(['image'], 'logo.png', { type: 'image/png' }),
  )
  expect(screen.getByText('Preview · Not uploaded yet')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Upload logo' }))
  await screen.findByText('Property logo saved')
  expect(name).toHaveValue('Unsaved name')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  await user.click(screen.getByRole('button', { name: 'Remove logo' }))
  await screen.findByText('Property logo removed')
  expect(current.logoUrl).toBeNull()
  expect(name).toHaveValue('Unsaved name')
})
it('rejects invalid selections without requests and revokes selected previews on unmount', async () => {
  const router = await show()
  const input = await screen.findByLabelText('Choose a logo')
  fireEvent.change(input, {
    target: { files: [new File([], 'empty.png', { type: 'image/png' })] },
  })
  expect(await screen.findByText('Choose a nonempty image file.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Upload logo' })).toBeDisabled()
  expect(writes).toEqual([])
  fireEvent.change(input, {
    target: {
      files: [new File(['image'], 'logo.webp', { type: 'image/webp' })],
    },
  })
  await act(() => router.navigate({ to: '/admin' }))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})
it('retains the current logo and selection after upload failure and allows retry', async () => {
  current.logoUrl = 'https://example.com/old.png'
  const user = userEvent.setup()
  await show()
  const input = await screen.findByLabelText('Choose a logo')
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let fail = true
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/property/logo' && fail) {
      fail = false
      throw new ApiError('Offline', 'NETWORK_ERROR')
    }
    return adapter(config)
  }
  await user.upload(
    input,
    new File(['image'], 'logo.png', { type: 'image/png' }),
  )
  await user.click(screen.getByRole('button', { name: 'Replace logo' }))
  await screen.findByText('Unable to upload logo', {
    selector: '[data-slot=toast-title]',
  })
  expect(current.logoUrl).toBe('https://example.com/old.png')
  expect(screen.getByText('Preview · Not uploaded yet')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Replace logo' }))
  await screen.findByText('Property logo saved')
})
it('opens the saved image in a dialog and restores trigger focus after Escape', async () => {
  current.logoUrl = 'https://example.com/old.png'
  const user = userEvent.setup()
  await show()
  const trigger = await screen.findByRole('button', {
    name: 'Preview property logo',
  })
  trigger.focus()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', {
    name: 'Property logo preview',
  })
  expect(
    within(dialog).getByRole('img', { name: 'Enlarged property logo' }),
  ).toHaveAttribute('src', current.logoUrl)
  expect(dialog).toHaveAccessibleDescription('Current property logo')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
  expect(writes).toEqual([])
})
it('previews local selections without uploading and closes with its close control', async () => {
  const user = userEvent.setup()
  await show()
  const input = await screen.findByLabelText('Choose a logo')
  expect(
    screen.queryByRole('button', { name: 'Preview property logo' }),
  ).not.toBeInTheDocument()
  await user.upload(
    input,
    new File(['image'], 'logo.png', { type: 'image/png' }),
  )
  const trigger = screen.getByRole('button', { name: 'Preview property logo' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', {
    name: 'Property logo preview',
  })
  expect(dialog).toHaveAccessibleDescription(
    'Selected image · Not uploaded yet',
  )
  expect(
    within(dialog).getByRole('img', { name: 'Enlarged property logo' }),
  ).toHaveAttribute('src', 'blob:preview')
  await user.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
  expect(writes).toEqual([])
  await user.click(screen.getByRole('button', { name: 'Cancel selection' }))
  expect(
    screen.queryByRole('button', { name: 'Preview property logo' }),
  ).not.toBeInTheDocument()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})
it('does not offer an enlarged preview when the saved image fails to load', async () => {
  current.logoUrl = 'https://example.com/broken.png'
  await show()
  const trigger = await screen.findByRole('button', {
    name: 'Preview property logo',
  })
  fireEvent.error(within(trigger).getByRole('img', { name: 'Property logo' }))
  expect(
    screen.queryByRole('button', { name: 'Preview property logo' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('shows a submit failure toast, retains input, and allows retry', async () => {
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  await user.clear(name)
  await user.type(name, 'Draft name')
  const adapter = apiClient.defaults.adapter
  apiClient.defaults.adapter = async () => {
    throw new ApiError('Offline', 'NETWORK_ERROR')
  }
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Unable to save property details', {
    selector: '[data-slot=toast-title]',
  })
  expect(
    screen.getByText('Offline', { selector: '[data-slot=toast-description]' }),
  ).toBeVisible()
  expect(
    within(name.closest('form')!).queryByText('Offline'),
  ).not.toBeInTheDocument()
  expect(name).toHaveValue('Draft name')
  apiClient.defaults.adapter = adapter
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Property details saved')
})
it.each([
  [404, 'NOT_FOUND', 'Property not found'],
  [403, 'FORBIDDEN', 'Access to property denied'],
  [500, 'INTERNAL_ERROR', 'Service unavailable'],
])(
  'shows load failure %s and supports explicit retry',
  async (status, code, message) => {
    const adapter = apiClient.defaults.adapter as AxiosAdapter
    const fail = vi.fn<AxiosAdapter>(async () => {
      throw new ApiError(message, code, status)
    })
    apiClient.defaults.adapter = fail
    await show()
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(fail).toHaveBeenCalledOnce()
    apiClient.defaults.adapter = adapter
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Name')).toHaveValue(property.name)
  },
)
it.each(['RESIDENT', 'TECHNICIAN'] as const)(
  'denies settings to %s before reading property data',
  async (role) => {
    const adapter = vi.fn<AxiosAdapter>()
    apiClient.defaults.adapter = adapter
    await show('/admin/settings', role)
    await screen.findByRole('heading', { name: 'Access denied' })
    expect(adapter).not.toHaveBeenCalled()
  },
)
it('validates account search, opens the correct submenu, and supports keyboard collapse and navigation', async () => {
  expect(accountsSearchSchema.parse({ role: 'OWNER' })).toEqual({
    role: undefined,
  })
  const user = userEvent.setup()
  const router = await show('/admin/accounts?role=RESIDENT')
  const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
  expect(within(nav).getByRole('link', { name: 'Residents' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const accounts = within(nav).getByRole('button', { name: 'Accounts' })
  expect(accounts).toHaveAttribute('aria-expanded', 'true')
  accounts.focus()
  await user.keyboard('{Enter}')
  expect(accounts).toHaveAttribute('aria-expanded', 'false')
  await user.keyboard('{Enter}')
  await user.click(within(nav).getByRole('link', { name: 'Technicians' }))
  await screen.findByRole('heading', { name: 'Technicians' })
  expect(router.state.location.search.role).toBe('TECHNICIAN')
  expect(
    within(nav).getByRole('link', { name: 'Technicians' }),
  ).toHaveAttribute('aria-current', 'page')
})
it('keeps Accounts destinations accessible in the mini sidebar and restores expanded navigation', async () => {
  const user = userEvent.setup()
  const router = await show('/admin/accounts?role=RESIDENT')
  await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(
    screen.getByRole('button', { name: 'Expand sidebar' }),
  ).toHaveAttribute('aria-pressed', 'true')
  const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
  expect(
    within(nav).getByRole('link', { name: 'Dashboard' }),
  ).toBeInTheDocument()
  const accounts = within(nav).getByRole('button', { name: 'Accounts' })
  accounts.focus()
  await user.keyboard('{Enter}')
  await user.click(await screen.findByRole('menuitem', { name: 'Technicians' }))
  await screen.findByRole('heading', { name: 'Technicians' })
  expect(router.state.location.search.role).toBe('TECHNICIAN')
  await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
  expect(
    within(nav).getByRole('link', { name: 'Technicians' }),
  ).toHaveAttribute('aria-current', 'page')
})
it('uses the saved logo alone for sidebar branding and falls back on image failure or removal', async () => {
  current.logoUrl = 'https://example.com/property.png'
  await show()
  const brand = await screen.findByRole('link', { name: 'Admin home' })
  const sidebar = screen.getByRole('complementary', { name: 'Admin sidebar' })
  const image = await within(brand).findByRole('img', { name: 'Property logo' })
  expect(within(brand).queryByText('Property')).not.toBeInTheDocument()
  fireEvent.error(image)
  expect(within(brand).getByText(property.name)).toBeVisible()
  await act(async () =>
    client.setQueryData(propertyQueryKey, {
      ...property,
      logoUrl: 'https://example.com/replacement.png',
    }),
  )
  expect(
    await within(sidebar).findByRole('img', { name: 'Property logo' }),
  ).toHaveAttribute('src', 'https://example.com/replacement.png')
  await act(async () =>
    client.setQueryData(propertyQueryKey, { ...property, logoUrl: null }),
  )
  expect(await within(sidebar).findByText(property.name)).toBeVisible()
})
it('uses the saved name for fallback branding, updates after saving, and retains the full name in the mini rail', async () => {
  const user = userEvent.setup()
  await show()
  const name = await screen.findByLabelText('Name')
  const brand = screen.getByRole('link', { name: 'Admin home' })
  expect(within(brand).getByText(property.name)).toBeVisible()
  const longName = 'W'.repeat(160)
  await user.clear(name)
  await user.type(name, longName)
  expect(within(brand).getByText(property.name)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Property details saved')
  expect(within(brand).getByText(longName)).toBeVisible()
  expect(brand).toHaveAccessibleDescription(longName)
  expect(brand).toHaveAttribute('title', longName)
  await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(within(brand).queryByText(longName)).not.toBeInTheDocument()
  expect(brand).toHaveAccessibleDescription(longName)
})
const settingsActions = [
  {
    action: 'details',
    pendingFlag: 'saving',
    start: (settings: ReturnType<typeof usePropertySettings>) =>
      settings.saveDetails({ name: 'Changed' }),
  },
  {
    action: 'upload',
    pendingFlag: 'uploading',
    start: (settings: ReturnType<typeof usePropertySettings>) =>
      settings.uploadLogo(
        new File(['image'], 'logo.png', { type: 'image/png' }),
      ),
  },
  {
    action: 'remove',
    pendingFlag: 'removing',
    start: (settings: ReturnType<typeof usePropertySettings>) =>
      settings.removeLogo(),
  },
] as const

it.each(settingsActions)(
  'blocks overlapping writes and ignores late $action responses after session expiration',
  async ({ start, pendingFlag }) => {
    const feedback = vi.spyOn(toast, 'add')
    client.setQueryData(sessionKey, admin)
    client.setQueryData(propertyQueryKey, property)
    let resolve: ((value: AxiosResponse) => void) | undefined
    let config: Parameters<AxiosAdapter>[0] | undefined
    apiClient.defaults.adapter = vi.fn<AxiosAdapter>((request) => {
      config = request
      return new Promise((done) => {
        resolve = done
      })
    })
    const { result } = renderHook(() => usePropertySettings(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    let pending: ReturnType<typeof result.current.saveDetails> | undefined
    await act(async () => {
      pending = start(result.current)
      expect(
        await result.current.saveDetails({ name: 'Overlapping' }),
      ).toBeUndefined()
      expect(
        await result.current.uploadLogo(
          new File(['image'], 'other.png', { type: 'image/png' }),
        ),
      ).toBeUndefined()
      expect(await result.current.removeLogo()).toBeUndefined()
    })
    await waitFor(() => expect(resolve).toBeDefined())
    expect(apiClient.defaults.adapter).toHaveBeenCalledOnce()
    expect(result.current.busy).toBe(true)
    expect(result.current[pendingFlag]).toBe(true)
    await act(async () => {
      await expireSession(client)
      if (config)
        resolve?.({
          data: { ...property, name: 'Changed' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        })
      expect(await pending).toBeUndefined()
    })
    expect(client.getQueryData(propertyQueryKey)).toBeUndefined()
    expect(feedback).not.toHaveBeenCalled()
  },
)
it.each(settingsActions)(
  'aborts the pending $action write on unmount',
  async ({ start }) => {
    client.setQueryData(sessionKey, admin)
    client.setQueryData(propertyQueryKey, property)
    let resolve: ((value: AxiosResponse) => void) | undefined
    let config: Parameters<AxiosAdapter>[0] | undefined
    apiClient.defaults.adapter = (request) => {
      config = request
      return new Promise((done) => {
        resolve = done
      })
    }
    const { result, unmount } = renderHook(() => usePropertySettings(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    let pending: ReturnType<typeof result.current.saveDetails> | undefined
    await act(async () => {
      pending = start(result.current)
    })
    await waitFor(() => expect(resolve).toBeDefined())
    unmount()
    expect(config?.signal?.aborted).toBe(true)
    if (config)
      resolve?.({
        data: property,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    expect(await pending).toBeUndefined()
  },
)

it.each([
  ['details', 'Save changes', 'Saving…', 'Property details saved'],
  ['upload', 'Replace logo', 'Uploading…', 'Property logo saved'],
  ['remove', 'Remove logo', 'Removing…', 'Property logo removed'],
])(
  'shows the %s busy state and disables editing until it finishes',
  async (action, button, pendingLabel, successTitle) => {
    current.logoUrl = 'https://example.com/current.png'
    const user = userEvent.setup()
    const adapter = apiClient.defaults.adapter as AxiosAdapter
    let release!: () => void
    const ready = new Promise<void>((resolve) => {
      release = resolve
    })
    apiClient.defaults.adapter = async (config) => {
      if (config.method !== 'get') await ready
      return adapter(config)
    }
    await show()
    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Draft name')
    const fileInput = screen.getByLabelText('Choose a logo')
    if (action === 'upload')
      await user.upload(
        fileInput,
        new File(['image'], 'logo.png', { type: 'image/png' }),
      )
    await user.click(screen.getByRole('button', { name: button }))
    const pendingButton = await screen.findByRole('button', {
      name: pendingLabel,
    })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveAttribute('aria-busy', 'true')
    expect(name).toHaveAttribute('readonly')
    expect(fileInput).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Save changes|Saving…/ }),
    ).toBeDisabled()
    await act(async () => release())
    await screen.findByText(successTitle)
    expect(name).not.toHaveAttribute('readonly')
    expect(fileInput).not.toBeDisabled()
    expect(name).toHaveValue('Draft name')
  },
)
