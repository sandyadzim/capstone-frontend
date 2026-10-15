// @vitest-environment jsdom
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
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { routeTree } from '@/routeTree.gen'
import { sessionKey } from '@/features/auth/auth-session'
import {
  residentPropertyQueryOptions,
  residentUnitQueryOptions,
} from '@/features/resident/resident-queries'
import { useThemeStore } from '@/stores/theme-store'
import { property as sampleProperty } from '../admin/settings/fixtures'

const resident = {
  id: '33000000-0000-4000-8000-000000000003',
  name: 'Maya Aditya',
  loginIdentifier: 'maya',
  role: 'RESIDENT' as const,
}
const sampleUnit = {
  id: '11000000-0000-4000-8000-000000000002',
  unitNumber: 'A-204',
  floor: 2,
}
const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let property = { ...sampleProperty }
let unit: typeof sampleUnit | null
let unitError: ApiError | undefined
let propertyError: ApiError | undefined
let holdUnit: Promise<void> | undefined
let holdProperty: Promise<void> | undefined
let requests: string[]
let signedOut: boolean

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  client = createQueryClient()
  unit = { ...sampleUnit }
  property = { ...sampleProperty }
  unitError = propertyError = undefined
  holdUnit = holdProperty = undefined
  requests = []
  signedOut = false
  useThemeStore.setState({ theme: 'system' })
  apiClient.defaults.adapter = async (config) => {
    requests.push(config.url ?? '')
    if (config.url === '/auth/logout') {
      signedOut = true
      return {
        data: null,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config,
      }
    }
    let data: unknown
    if (config.url === '/auth/me') {
      if (signedOut) throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
      data = resident
    } else if (config.url === '/resident/unit') {
      await holdUnit
      if (unitError) throw unitError
      data = { unit }
    } else if (config.url === '/property') {
      await holdProperty
      if (propertyError) throw propertyError
      data = property
    } else if (config.url === '/reports') {
      data = {
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }
    } else throw new Error(`Unexpected request ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})

async function show(
  role: 'RESIDENT' | 'ADMIN' = 'RESIDENT',
  path = '/profile',
) {
  client.setQueryData(sessionKey, { ...resident, role })
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
function section(name: string) {
  return screen.getByRole('region', { name })
}

it('keeps the Concierge home focused and links the avatar to the live profile', async () => {
  const user = userEvent.setup()
  const router = await show('RESIDENT', '/')
  expect(
    await screen.findByRole('heading', { name: /Welcome home,\s*Maya Aditya/ }),
  ).toBeVisible()
  expect(await screen.findByText(/Unit A-204/)).toBeVisible()
  expect(
    screen.getByRole('heading', { name: 'Your ongoing reports' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Report a problem' }),
  ).not.toBeInTheDocument()
  const navigation = screen.getByRole('navigation', {
    name: 'Resident navigation',
  })
  expect(
    within(navigation).getByRole('link', { name: 'Home' }),
  ).toHaveAttribute('aria-current', 'page')
  expect(
    within(navigation).getByRole('button', {
      name: 'Report',
    }),
  ).toBeEnabled()
  expect(
    within(navigation).getByRole('button', { name: 'Reports' }),
  ).toBeDisabled()
  expect(
    screen.queryByRole('region', { name: 'Your account' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Property' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText(property.address)).not.toBeInTheDocument()
  expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { name: 'No ongoing reports' }),
  ).toBeVisible()
  expect(
    within(navigation).getByRole('button', { name: 'Report' }),
  ).not.toHaveTextContent('Report')
  await user.click(
    screen.getByRole('link', { name: `Open profile for ${resident.name}` }),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
  expect(
    await screen.findByRole('heading', { name: 'Your profile' }),
  ).toBeVisible()
  expect(within(section('Your account')).getByText('maya')).toBeVisible()
  expect(within(section('Your unit')).getByText('A-204')).toBeVisible()
  expect(within(section('Property')).getByText(property.address)).toBeVisible()
  expect(requests.filter((url) => url === '/resident/unit')).toHaveLength(1)
  expect(requests.some((url) => url.includes('/accounts'))).toBe(false)
  await user.click(screen.getByRole('link', { name: 'Back to home' }))
  expect(
    await screen.findByRole('heading', { name: /Welcome home/ }),
  ).toBeVisible()
})

it('keeps unassigned guidance on the homepage without displaying full account details', async () => {
  unit = null
  await show('RESIDENT', '/')
  expect(await screen.findByText('Let’s get you settled')).toBeVisible()
  expect(screen.getByText(/Contact your property administrator/)).toBeVisible()
  expect(screen.queryByText('Login ID')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Your ongoing reports' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Report a problem' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'View your profile' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('navigation', { name: 'Resident navigation' }),
  ).toBeVisible()
})

it('shows homepage read failures with retry rather than no-placement guidance', async () => {
  unitError = new ApiError('Service unavailable', 'HTTP_ERROR', 503)
  await show('RESIDENT', '/')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t load your unit',
  )
  expect(screen.queryByText('Let’s get you settled')).not.toBeInTheDocument()
  unitError = undefined
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText(/Unit A-204/)).toBeVisible()
})

it('shows the unassigned state while retaining account and property information', async () => {
  unit = null
  await show()
  expect(
    await screen.findByText(
      'Your account hasn’t been assigned to a unit yet. Please contact your property administrator.',
    ),
  ).toBeVisible()
  expect(within(section('Your account')).getByText(resident.name)).toBeVisible()
  expect(within(section('Property')).getByText(property.address)).toBeVisible()
  expect(screen.getAllByText('No unit assigned')).toHaveLength(1)
})

it('retains long account, unit and property values in the information sections', async () => {
  const account = {
    ...resident,
    name: 'N'.repeat(160),
    loginIdentifier: 'L'.repeat(254),
  }
  unit = { ...sampleUnit, unitNumber: 'U'.repeat(40), floor: -1 }
  property = { ...property, name: 'P'.repeat(160), address: 'A'.repeat(300) }
  await show()
  await act(async () => client.setQueryData(sessionKey, account))
  expect(
    await within(section('Your unit')).findByText(unit.unitNumber),
  ).toBeVisible()
  expect(within(section('Your account')).getByText(account.name)).toBeVisible()
  expect(
    within(section('Your account')).getByText(account.loginIdentifier),
  ).toBeVisible()
  expect(
    await within(section('Property')).findByText(property.address),
  ).toBeVisible()
  expect(within(section('Property')).getByText(property.name)).toBeVisible()
})

it('loads property and unit independently and never flashes unassigned copy', async () => {
  let releaseUnit!: () => void
  let releaseProperty!: () => void
  holdUnit = new Promise((resolve) => {
    releaseUnit = resolve
  })
  holdProperty = new Promise((resolve) => {
    releaseProperty = resolve
  })
  await show()
  expect(
    screen.getByRole('status', { name: 'Loading unit information' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('status', { name: 'Loading property information' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('No unit assigned')).not.toBeInTheDocument()
  expect(within(section('Your account')).getByText('maya')).toBeVisible()
  await act(async () => releaseProperty())
  expect(
    await within(section('Property')).findByText(property.address),
  ).toBeVisible()
  expect(
    screen.getByRole('status', { name: 'Loading unit information' }),
  ).toBeInTheDocument()
  await act(async () => releaseUnit())
  expect(await within(section('Your unit')).findByText('A-204')).toBeVisible()
})

it.each(['unit', 'property'] as const)(
  'keeps an initial %s error distinct and retries that section',
  async (target) => {
    const error = new ApiError('Service unavailable', 'HTTP_ERROR', 503)
    if (target === 'unit') unitError = error
    else propertyError = error
    await show()
    const region = section(target === 'unit' ? 'Your unit' : 'Property')
    expect(await within(region).findByRole('alert')).toHaveTextContent(
      'couldn’t load',
    )
    expect(screen.queryByText('No unit assigned')).not.toBeInTheDocument()
    expect(within(section('Your account')).getByText('maya')).toBeVisible()
    unitError = propertyError = undefined
    await userEvent.click(within(region).getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(within(region).queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(
      within(region).getByText(target === 'unit' ? 'A-204' : property.address),
    ).toBeVisible()
  },
)

it.each(['unit', 'property'] as const)(
  'retains data and explains a failed %s background refresh',
  async (target) => {
    await show()
    await within(section('Your unit')).findByText('A-204')
    await within(section('Property')).findByText(property.address)
    const error = new ApiError('Service unavailable', 'HTTP_ERROR', 503)
    if (target === 'unit') unitError = error
    else propertyError = error
    await act(async () => {
      await client.invalidateQueries({
        queryKey:
          target === 'unit'
            ? residentUnitQueryOptions(resident.id).queryKey
            : residentPropertyQueryOptions.queryKey,
      })
    })
    const region = section(target === 'unit' ? 'Your unit' : 'Property')
    expect(await within(region).findByRole('alert')).toHaveTextContent(
      'couldn’t refresh',
    )
    expect(
      within(region).getByText(target === 'unit' ? 'A-204' : property.address),
    ).toBeVisible()
  },
)

it('updates placement from assigned to released to a new unit', async () => {
  await show()
  await within(section('Your unit')).findByText('A-204')
  unit = null
  await act(async () => {
    await client.invalidateQueries({
      queryKey: residentUnitQueryOptions(resident.id).queryKey,
    })
  })
  await screen.findByText(/Your account hasn’t been assigned/)
  unit = { ...sampleUnit, unitNumber: 'B-101', floor: 0 }
  await act(async () => {
    await client.invalidateQueries({
      queryKey: residentUnitQueryOptions(resident.id).queryKey,
    })
  })
  expect(await within(section('Your unit')).findByText('B-101')).toBeVisible()
  expect(within(section('Your unit')).getByText('0')).toBeVisible()
  expect(screen.queryByText('No unit assigned')).not.toBeInTheDocument()
})

it('falls back from a broken logo and resets the image when its URL changes', async () => {
  property.logoUrl = 'https://example.com/logo.png'
  await show('RESIDENT', '/')
  const logo = await screen.findByRole('img', { name: property.name })
  fireEvent.error(logo)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: `${property.name} · Resident home` }),
  ).toHaveTextContent(property.name)
  property.logoUrl = 'https://example.com/new-logo.png'
  await act(async () => {
    await client.invalidateQueries({
      queryKey: residentPropertyQueryOptions.queryKey,
    })
  })
  expect(
    await screen.findByRole('img', { name: property.name }),
  ).toHaveAttribute('src', property.logoUrl)
})

it('opens the profile by keyboard and signs out with private-cache cleanup', async () => {
  const user = userEvent.setup()
  const router = await show('RESIDENT', '/')
  await screen.findByText(/Unit A-204/)
  const link = screen.getByRole('link', {
    name: `Open profile for ${resident.name}`,
  })
  link.focus()
  await user.keyboard('{Enter}')
  expect(
    await screen.findByRole('heading', { name: 'Your profile' }),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(
    client.getQueryData(residentUnitQueryOptions(resident.id).queryKey),
  ).toBeUndefined()
})

it('uses the existing persisted appearance controls', async () => {
  const user = userEvent.setup()
  await show()
  const appearance = screen.getByRole('group', { name: 'Appearance' })
  const system = within(appearance).getByRole('button', { name: 'System' })
  const light = within(appearance).getByRole('button', { name: 'Light' })
  const dark = within(appearance).getByRole('button', { name: 'Dark' })
  expect(system).toHaveAttribute('aria-pressed', 'true')
  await user.click(dark)
  expect(useThemeStore.getState().theme).toBe('dark')
  expect(dark).toHaveAttribute('aria-pressed', 'true')
  expect(system).toHaveAttribute('aria-pressed', 'false')
  await user.tab({ shift: true })
  expect(light).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(useThemeStore.getState().theme).toBe('light')
  await user.tab({ shift: true })
  expect(system).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(useThemeStore.getState().theme).toBe('system')
  expect(
    JSON.parse(localStorage.getItem('property-appearance') ?? '{}'),
  ).toMatchObject({
    state: { theme: 'system' },
  })
})

it('expires the session on a private 401 without showing an unassigned state', async () => {
  unitError = new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
  signedOut = true
  const router = await show()
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(screen.queryByText('No unit assigned')).not.toBeInTheDocument()
  expect(
    client.getQueryData(residentUnitQueryOptions(resident.id).queryKey),
  ).toBeUndefined()
})

it('blocks other roles before making resident data requests', async () => {
  await show('ADMIN')
  expect(
    await screen.findByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()
  expect(requests).not.toContain('/resident/unit')
  expect(requests).not.toContain('/property')
})
