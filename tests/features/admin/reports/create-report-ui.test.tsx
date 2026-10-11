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
import { createdReport, photo, reportPage } from './fixtures'
import { admin, property } from '../settings/fixtures'
import { unit } from '../units/fixtures'

const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: AxiosRequestConfig[]
let creationError: ApiError | undefined
let photoError: ApiError | undefined
let unitsError: ApiError | undefined
let units: (typeof unit)[]
let hold: Promise<void> | undefined
let holdUpload: Promise<void> | undefined
let saved: (typeof photo)[]
let created: boolean
let actor: typeof admin
const firstFile = () => new File(['image'], 'damage.png', { type: 'image/png' })
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  client = createQueryClient()
  requests = []
  units = [unit]
  saved = []
  created = false
  actor = admin
  creationError = undefined
  photoError = undefined
  unitsError = undefined
  hold = undefined
  holdUpload = undefined
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = actor
    else if (config.url === '/property') data = property
    else if (config.url === '/units') {
      if (unitsError) throw unitsError
      const { q = '', page = 1, pageSize = 20 } = config.params ?? {}
      const matching = units.filter((u) =>
        u.unitNumber.toLowerCase().includes(q.toLowerCase()),
      )
      data = reportPage(
        matching.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        matching.length,
      )
    } else if (config.url === '/reports' && config.method === 'post') {
      if (hold) await hold
      if (creationError) throw creationError
      created = true
      const body = JSON.parse(config.data)
      data = {
        ...createdReport,
        ...body,
        unit: { id: unit.id, unitNumber: unit.unitNumber, floor: unit.floor },
        damagePhotos: [],
      }
    } else if (config.url === '/reports' && config.method === 'get') {
      const { page = 1, pageSize = 20 } = config.params ?? {}
      data = reportPage(created ? [createdReport] : [], page, pageSize)
    } else if (config.url?.endsWith('/damage-photos')) {
      if (holdUpload) await holdUpload
      if (photoError) throw photoError
      data = {
        ...photo,
        id: `77000000-0000-4000-8000-${String(saved.length + 1).padStart(12, '0')}`,
      }
      saved.push(data as typeof photo)
    } else throw new Error(`Unhandled request ${config.method} ${config.url}`)
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
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function show(path = '/admin/reports/new?pageSize=50') {
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
  await screen.findByRole('heading', {
    name: path.startsWith('/admin/reports/new') ? 'Create report' : 'Reports',
  })
  return router
}
async function choose() {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: /^(Select|Change) unit$/ }),
  )
  await user.click(
    (await screen.findAllByRole('button', { name: 'Select unit A-101' }))[0],
  )
  return user
}
async function fill() {
  const user = await choose()
  await user.type(screen.getByLabelText('Title'), '  AC needs repair  ')
  await user.type(screen.getByLabelText('Description'), '  Warm room  ')
  await user.click(screen.getByRole('combobox', { name: 'Category' }))
  await user.click(await screen.findByRole('option', { name: 'AC' }))
  await user.click(screen.getByRole('combobox', { name: 'Priority' }))
  await user.click(await screen.findByRole('option', { name: 'High' }))
  return user
}
it('shows explicit fields and focuses the first invalid field without writes', async () => {
  await show()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  expect(await screen.findByText('Choose a unit.')).toBeInTheDocument()
  expect(await screen.findByText('Choose a category.')).toBeInTheDocument()
  expect(await screen.findByText('Choose a priority.')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /^(Select|Change) unit$/ }),
  ).toHaveFocus()
  expect(requests.filter((r) => r.method === 'post')).toHaveLength(0)
})
it('uses server unit search/pagination and restores trigger focus after selection', async () => {
  units = Array.from({ length: 21 }, (_, i) => ({
    ...unit,
    id: `55000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    unitNumber: i === 20 ? 'Z-121' : `A-${i + 1}`,
  }))
  await show()
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: /^(Select|Change) unit$/ }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Select unit' })
  await user.click(within(dialog).getByRole('button', { name: 'Next' }))
  await user.click(
    (
      await within(dialog).findAllByRole('button', {
        name: 'Select unit Z-121',
      })
    )[0],
  )
  expect(screen.getByRole('button', { name: 'Change unit' })).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Change unit' })).toHaveTextContent(
    'Change',
  )
  expect(screen.getByText('Z-121')).toBeInTheDocument()
  expect(screen.queryByText('Z-121 · Floor 1')).not.toBeInTheDocument()
  expect(
    requests
      .filter((r) => r.url === '/units')
      .every((r) => r.params.isArchived === 'false'),
  ).toBe(true)
  await user.click(
    screen.getByRole('button', { name: /^(Select|Change) unit$/ }),
  )
  await user.type(
    screen.getByRole('searchbox', { name: 'Search units' }),
    'Z-121',
  )
  await waitFor(() =>
    expect(requests.at(-1)?.params).toMatchObject({ q: 'Z-121', page: 1 }),
  )
})
it('allows creation without photos and returns to an unfiltered first page retaining size', async () => {
  const router = await show(
    '/admin/reports/new?q=missing&status=REJECTED&category=PLUMBING&priority=LOW&dateFrom=2026-01-01&page=3&pageSize=50',
  )
  const user = await fill()
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/reports'),
  )
  expect(router.state.location.search).toEqual({ pageSize: 50 })
  const post = requests.find((r) => r.url === '/reports' && r.method === 'post')
  expect(JSON.parse(post!.data)).toEqual({
    unitId: unit.id,
    title: 'AC needs repair',
    description: 'Warm room',
    category: 'AC',
    priority: 'HIGH',
  })
  expect(
    requests.filter((r) => r.url?.endsWith('/damage-photos')),
  ).toHaveLength(0)
})
it('keeps default creation and return links free of query parameters', async () => {
  const router = await show('/admin/reports/new')
  expect(
    within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole(
      'link',
      { name: 'Reports' },
    ),
  ).toHaveAttribute('href', '/admin/reports')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/reports'),
  )
  expect(router.state.location.searchStr).toBe('')
  expect(router.state.location.search).toEqual({})
  expect(requests.at(-1)?.params).toMatchObject({ page: 1, pageSize: 20 })
})
it('preserves source search in Cancel and breadcrumbs and adds list creation navigation', async () => {
  const router = await show(
    '/admin/reports/new?q=AC&category=AC&page=1&pageSize=10',
  )
  expect(
    within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole(
      'link',
      { name: 'Reports' },
    ),
  ).toHaveAttribute('href', expect.stringContaining('category=AC'))
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/reports'),
  )
  expect(router.state.location.search.category).toBe('AC')
  const returnedSearch = new URLSearchParams(router.state.location.searchStr)
  expect(returnedSearch.get('q')).toBe('AC')
  expect(returnedSearch.get('category')).toBe('AC')
  expect(returnedSearch.get('pageSize')).toBe('10')
  expect(returnedSearch.has('page')).toBe(false)
  expect(screen.getByRole('link', { name: 'Create report' })).toHaveAttribute(
    'href',
    expect.stringContaining('q=AC'),
  )
})
it('rejects too many/unsupported files and releases preview URLs after removal', async () => {
  await show()
  const user = userEvent.setup({ applyAccept: false })
  const input = screen.getByLabelText('Damage photos (optional)')
  await user.upload(
    input,
    new File(['x'], 'invalid.pdf', { type: 'application/pdf' }),
  )
  expect(
    screen.getByText('Choose a JPEG, PNG, or WebP image.'),
  ).toBeInTheDocument()
  await user.upload(
    input,
    Array.from({ length: 6 }, () => firstFile()),
  )
  expect(screen.getByText('Choose up to 5 images.')).toBeInTheDocument()
  await user.upload(input, firstFile())
  expect(screen.getByAltText('Selected image: damage.png')).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Remove image 1: damage.png' }),
  )
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  expect(
    screen.queryByAltText('Selected image: damage.png'),
  ).not.toBeInTheDocument()
})
it('shows one upload error and returns to Reports without recreating or retrying', async () => {
  photoError = new ApiError('File rejected', 'VALIDATION_ERROR', 400)
  const router = await show()
  const user = await fill()
  await user.upload(
    screen.getByLabelText('Damage photos (optional)'),
    firstFile(),
  )
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  expect(
    await screen.findByText(
      /was created, but photo upload failed. File rejected/,
    ),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveAttribute('readonly')
  expect(
    screen.queryByRole('button', { name: 'Create report' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', {
      name: /Retry remaining|Check saved|Skip photo/,
    }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Back to Reports' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/reports'),
  )
  expect(
    requests.filter((r) => r.url === '/reports' && r.method === 'post'),
  ).toHaveLength(1)
  expect(
    requests.filter((r) => r.url?.endsWith('/damage-photos')),
  ).toHaveLength(1)
})
it('shows a normal creation error and retains the editable draft', async () => {
  creationError = new ApiError('Service unavailable', 'HTTP_ERROR', 503)
  await show()
  const user = await fill()
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create report' })).toBeEnabled()
  expect(screen.getByLabelText('Title')).not.toHaveAttribute('readonly')
  expect(screen.getByLabelText('Title')).toHaveValue('  AC needs repair  ')
})
it('maps backend field errors and clears a stale selected unit without losing other drafts', async () => {
  const user = await (async () => {
    await show()
    return fill()
  })()
  creationError = new ApiError('Invalid title', 'VALIDATION_ERROR', 400, {
    issues: [{ path: ['title'], message: 'Backend title error' }],
  })
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  expect(await screen.findByText('Backend title error')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveFocus())
  creationError = new ApiError(
    'Archived units cannot receive reports',
    'CONFLICT',
    409,
  )
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  expect(
    await screen.findByText(
      'This unit is no longer available. Choose another unit.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveValue('  AC needs repair  ')
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /^(Select|Change) unit$/ }),
    ).toHaveFocus(),
  )
})
it('offers unit read retry and distinguishes no units from unmatched units', async () => {
  unitsError = new ApiError('Unable to read units', 'HTTP_ERROR', 503)
  await show()
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: /^(Select|Change) unit$/ }),
  )
  expect(await screen.findByText('Unable to read units')).toBeInTheDocument()
  unitsError = undefined
  units = []
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByText(/No non-archived units are available/),
  ).toBeInTheDocument()
  await user.type(
    screen.getByRole('searchbox', { name: 'Search units' }),
    'missing',
  )
  expect(
    await screen.findByText('No units match your search.'),
  ).toBeInTheDocument()
})
it('locks the page through creation and uploads, then unlocks after success', async () => {
  const router = await show()
  const user = await fill()
  await user.upload(
    screen.getByLabelText('Damage photos (optional)'),
    firstFile(),
  )
  let releaseCreate!: () => void
  let releaseUpload!: () => void
  hold = new Promise((resolve) => {
    releaseCreate = resolve
  })
  holdUpload = new Promise((resolve) => {
    releaseUpload = resolve
  })
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  const loader = await screen.findByRole('dialog', {
    name: 'Action in progress',
  })
  expect(within(loader).getByRole('status')).toHaveTextContent(
    'Creating report…',
  )
  expect(
    screen.queryByRole('link', { name: 'Reports' }),
  ).not.toBeInTheDocument()
  await user.keyboard('{Tab}{Escape}')
  expect(loader.contains(document.activeElement)).toBe(true)
  expect(router.state.location.pathname).toBe('/admin/reports/new')
  await act(async () => {
    releaseCreate()
  })
  await waitFor(() =>
    expect(within(loader).getByRole('status')).toHaveTextContent(
      'Uploading photo 1 of 1…',
    ),
  )
  expect(screen.getByRole('dialog', { name: 'Action in progress' })).toBe(
    loader,
  )
  await act(async () => {
    releaseUpload()
  })
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/admin/reports'),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Action in progress' }),
    ).not.toBeInTheDocument(),
  )
})
it('expires the session on a private write 401 and returns to Login', async () => {
  creationError = new ApiError('Expired', 'UNAUTHORIZED', 401)
  const router = await show()
  const user = await fill()
  await user.click(screen.getByRole('button', { name: 'Create report' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(client.getQueryData(sessionKey)).toBeNull()
  expect(
    screen.queryByRole('dialog', { name: 'Leave report creation?' }),
  ).not.toBeInTheDocument()
})

it.each(['/admin/reports?q=AC&page=2', '/admin/reports/new?q=AC&pageSize=50'])(
  'keeps Reports navigation active at %s',
  async (path) => {
    await show(path)
    const nav = within(
      screen.getByRole('navigation', { name: 'Admin navigation' }),
    )
    expect(nav.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(nav.getByRole('link', { name: 'Reports' })).toHaveClass(
      'admin-nav-selected',
    )
    expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
  },
)

it('allows removing a tile at the five-photo limit and restores the add control focus', async () => {
  await show()
  const user = userEvent.setup()
  const input = screen.getByLabelText('Damage photos (optional)')
  await user.upload(
    input,
    Array.from({ length: 5 }, () => firstFile()),
  )
  expect(input).toBeDisabled()
  expect(screen.getAllByAltText('Selected image: damage.png')).toHaveLength(5)
  await user.click(
    screen.getByRole('button', { name: 'Remove image 1: damage.png' }),
  )
  await waitFor(() => expect(input).toHaveFocus())
  expect(input).toBeEnabled()
  await user.upload(input, firstFile())
  expect(screen.getAllByAltText('Selected image: damage.png')).toHaveLength(5)
  expect(input).toBeDisabled()
})

it('opens a selected photo preview and restores its trigger focus on Escape', async () => {
  await show()
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText('Damage photos (optional)'),
    firstFile(),
  )
  const preview = screen.getByRole('button', {
    name: 'Preview image 1: damage.png',
  })
  await user.click(preview)
  const dialog = await screen.findByRole('dialog', {
    name: 'Image preview',
  })
  expect(
    within(dialog).getByAltText('Selected image: damage.png'),
  ).toHaveAttribute('src', 'blob:preview')
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Image preview' }),
    ).not.toBeInTheDocument(),
  )
  expect(preview).toHaveFocus()
  expect(screen.getByAltText('Selected image: damage.png')).toBeInTheDocument()
  expect(requests.filter((request) => request.method === 'post')).toHaveLength(
    0,
  )
})
