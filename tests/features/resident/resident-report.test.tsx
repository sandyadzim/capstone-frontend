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
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { routeTree } from '@/routeTree.gen'
import { sessionKey, clearRevokedSession } from '@/features/auth/auth-session'
import { residentUnitQueryOptions } from '@/features/resident/resident-queries'
import { report, photo } from '../admin/reports/fixtures'
import { property } from '../admin/settings/fixtures'

const resident = {
  id: '33000000-0000-4000-8000-000000000003',
  name: 'Maya Aditya',
  loginIdentifier: 'maya',
  role: 'RESIDENT' as const,
}
const original = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let requests: AxiosRequestConfig[]
let unit: typeof report.unit | null
let unitError: ApiError | undefined
let createError: ApiError | undefined
let uploadErrorAt: number | undefined
let holdUnit: Promise<void> | undefined
let holdCreate: Promise<void> | undefined
let holdUpload: Promise<void> | undefined
let uploads: number

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  client = createQueryClient()
  requests = []
  unit = { ...report.unit }
  unitError = createError = undefined
  holdUnit = holdCreate = holdUpload = undefined
  uploadErrorAt = undefined
  uploads = 0
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    let data: unknown
    if (config.url === '/auth/me') data = resident
    else if (config.url === '/property') data = property
    else if (config.url === '/resident/unit') {
      await holdUnit
      if (unitError) throw unitError
      data = { unit }
    } else if (config.url === '/reports' && config.method === 'get') {
      data = {
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      }
    } else if (config.url === '/reports' && config.method === 'post') {
      await holdCreate
      if (createError) throw createError
      const body = JSON.parse(config.data)
      data = {
        ...report,
        ...body,
        unit,
        proposedPriority: body.priority,
        finalPriority: null,
        damagePhotos: [],
      }
    } else if (config.url?.endsWith('/damage-photos')) {
      ++uploads
      await holdUpload
      if (uploadErrorAt === uploads)
        throw new ApiError('Storage unavailable', 'HTTP_ERROR', 503)
      data = {
        ...photo,
        id: `77000000-0000-4000-8000-${String(uploads).padStart(12, '0')}`,
      }
    } else throw new Error(`Unexpected request ${config.method} ${config.url}`)
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
})

async function show(path = '/') {
  client.setQueryData(sessionKey, resident)
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await act(() => router.load())
  return { router, ...view }
}
async function open() {
  const button = await screen.findByRole('button', { name: 'Report' })
  await waitFor(() => expect(button).toBeEnabled())
  await userEvent.click(button)
  return screen.findByRole('dialog', { name: 'Report a problem' })
}
async function fill() {
  await userEvent.type(screen.getByLabelText('Title'), '  AC is not cooling  ')
  await userEvent.type(
    screen.getByLabelText('Description'),
    '  The room remains warm.  ',
  )
  await userEvent.click(screen.getByRole('combobox', { name: 'Category' }))
  await userEvent.click(await screen.findByRole('option', { name: 'AC' }))
  await userEvent.click(screen.getByRole('combobox', { name: 'Priority' }))
  await userEvent.click(await screen.findByRole('option', { name: 'High' }))
}
const creates = () =>
  requests.filter((r) => r.url === '/reports' && r.method === 'post')
const file = (name = 'damage.png') =>
  new File(['image'], name, { type: 'image/png' })

it('opens the form only from the navigation plus without changing the URL', async () => {
  const { router } = await show()
  const dialog = await open()
  expect(within(dialog).getAllByRole('combobox')).toHaveLength(2)
  expect(
    within(dialog).getByRole('combobox', { name: 'Category' }),
  ).toHaveTextContent('Select category')
  expect(
    within(dialog).getByRole('combobox', { name: 'Priority' }),
  ).toHaveTextContent('Select priority')
  expect(router.state.location.pathname).toBe('/')
  expect(creates()).toHaveLength(0)
})

it('supports the navigation plus on Profile and keyboard activation/focus return', async () => {
  await show('/profile')
  const trigger = await screen.findByRole('button', {
    name: 'Report',
  })
  await waitFor(() => expect(trigger).toBeEnabled())
  trigger.focus()
  await userEvent.keyboard('{Enter}')
  expect(
    await screen.findByRole('dialog', { name: 'Report a problem' }),
  ).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(trigger).toHaveFocus())
})

it.each(['unassigned', 'loading', 'error'])(
  'blocks creation when placement is %s',
  async (state) => {
    if (state === 'unassigned') unit = null
    if (state === 'loading') holdUnit = new Promise(() => {})
    if (state === 'error')
      unitError = new ApiError('Unavailable', 'HTTP_ERROR', 503)
    await show()
    await screen.findByRole('navigation', { name: 'Resident navigation' })
    if (state === 'unassigned') await screen.findByText('Let’s get you settled')
    if (state === 'error') await screen.findByRole('alert')
    expect(
      screen.queryByRole('button', { name: 'Report' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(creates()).toHaveLength(0)
  },
)

it('validates all required fields, focuses the first error, and catches trimmed title length', async () => {
  await show()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  expect(await screen.findByText('Enter a title.')).toBeVisible()
  expect(screen.getByText('Enter a description.')).toBeVisible()
  expect(screen.getByText('Choose a category.')).toBeVisible()
  expect(screen.getByText('Choose a priority.')).toBeVisible()
  expect(screen.getByLabelText('Title')).toHaveFocus()
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'T'.repeat(161) },
  })
  expect(
    await screen.findByText('Keep the title to 160 characters or fewer.'),
  ).toBeVisible()
  expect(creates()).toHaveLength(0)
})

it('submits only the assigned unit and trimmed fields, then confirms and refreshes the homepage list', async () => {
  await show()
  await open()
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  const confirmation = await screen.findByRole('dialog', {
    name: 'Report created successfully',
  })
  expect(JSON.parse(creates()[0].data)).toEqual({
    unitId: report.unit.id,
    title: 'AC is not cooling',
    description: 'The room remains warm.',
    category: 'AC',
    priority: 'HIGH',
  })
  expect(confirmation).not.toHaveTextContent(report.reportNumber)
  expect(confirmation).not.toHaveTextContent(report.title)
  expect(
    confirmation.querySelector('[data-slot="sheet-header"]'),
  ).not.toBeInTheDocument()
  expect(
    within(confirmation).getByText('Your report is awaiting admin review.'),
  ).toBeVisible()
  expect(
    requests.filter((r) => r.url === '/reports' && r.method === 'get').length,
  ).toBeGreaterThanOrEqual(2)
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Report created successfully' }),
    ).toHaveFocus(),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  await open()
  expect(screen.getByLabelText('Title')).toHaveValue('')
  expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveTextContent(
    'Select priority',
  )
})

it.each(['Cancel', 'Close', 'Escape', 'outside'])(
  'discards text and selected photos on %s',
  async (dismiss) => {
    await show()
    await open()
    await userEvent.type(screen.getByLabelText('Title'), 'Draft')
    await userEvent.upload(
      screen.getByLabelText('Damage photos (optional)'),
      file(),
    )
    if (dismiss === 'Escape') await userEvent.keyboard('{Escape}')
    else if (dismiss === 'outside')
      await userEvent.click(
        document.querySelector('[data-slot="sheet-overlay"]')!,
      )
    else await userEvent.click(screen.getByRole('button', { name: dismiss }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await open()
    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(
      screen.queryByAltText('Selected image: damage.png'),
    ).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  },
)

it('retains drafts and field errors after creation failure and allows manual retry', async () => {
  createError = new ApiError('Invalid title', 'VALIDATION_ERROR', 400, {
    issues: [{ path: ['title'], message: 'Use a different title.' }],
  })
  await show()
  await open()
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  expect(await screen.findByText('Use a different title.')).toBeVisible()
  expect(screen.getByLabelText('Description')).toHaveValue(
    '  The room remains warm.  ',
  )
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveFocus())
  expect(creates()).toHaveLength(1)
  createError = undefined
  await userEvent.clear(screen.getByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'New title')
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  expect(
    await screen.findByRole('dialog', { name: 'Report created successfully' }),
  ).toBeVisible()
  expect(creates()).toHaveLength(2)
})

it('refreshes lost placement after a conflict and blocks submission while keeping the draft', async () => {
  await show()
  await open()
  await fill()
  createError = new ApiError('Unit unavailable', 'CONFLICT', 409)
  unit = null
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Submit report' }),
    ).toBeDisabled(),
  )
  expect(screen.getByLabelText('Title')).toHaveValue('  AC is not cooling  ')
  expect(requests.filter((r) => r.url === '/resident/unit')).toHaveLength(2)
})

it('uses refreshed placement when the assignment changes during editing', async () => {
  await show()
  await open()
  await fill()
  unit = {
    ...report.unit,
    id: '11000000-0000-4000-8000-000000000009',
    unitNumber: 'C-309',
  }
  act(() =>
    client.setQueryData(residentUnitQueryOptions(resident.id).queryKey, {
      unit,
    }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  await screen.findByRole('dialog', { name: 'Report created successfully' })
  expect(JSON.parse(creates()[0].data).unitId).toBe(unit.id)
})

it.each(['create', 'upload'])(
  'locks dismissal and duplicate submission during %s',
  async (phase) => {
    let release!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    if (phase === 'create') holdCreate = hold
    else holdUpload = hold
    await show()
    await open()
    await fill()
    if (phase === 'upload')
      await userEvent.upload(
        screen.getByLabelText('Damage photos (optional)'),
        file(),
      )
    const form = screen
      .getByRole('button', { name: 'Submit report' })
      .closest('form')!
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    const loader = await screen.findByRole('dialog', {
      name: 'Action in progress',
    })
    if (phase === 'upload') await screen.findByText('Loading…')
    fireEvent.submit(form)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(
      document.querySelector('[data-slot="dialog-overlay"]')!,
    )
    expect(loader).toBeVisible()
    expect(creates()).toHaveLength(1)
    release()
    expect(
      await screen.findByRole('dialog', {
        name: 'Report created successfully',
      }),
    ).toBeVisible()
  },
)

it('uploads photos in order and confirms partial success without retry or duplicate creation', async () => {
  uploadErrorAt = 2
  await show()
  await open()
  await fill()
  await userEvent.upload(screen.getByLabelText('Damage photos (optional)'), [
    file('one.png'),
    file('two.png'),
    file('three.png'),
  ])
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  const confirmation = await screen.findByRole('dialog', {
    name: 'Report created successfully',
  })
  expect(within(confirmation).getByRole('alert')).toHaveTextContent(
    'Your report was created, but some selected photos could not be uploaded.',
  )
  expect(confirmation).not.toHaveTextContent(report.reportNumber)
  expect(confirmation).not.toHaveTextContent(report.title)
  expect(uploads).toBe(2)
  const uploaded = requests.filter((r) => r.url?.endsWith('/damage-photos'))
  expect(uploaded.map((r) => (r.data as FormData).get('file'))).toEqual([
    expect.objectContaining({ name: 'one.png' }),
    expect.objectContaining({ name: 'two.png' }),
  ])
  expect(creates()).toHaveLength(1)
  expect(
    screen.queryByRole('button', { name: /retry/i }),
  ).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(creates()).toHaveLength(1)
})

it('validates photo count, type and size and supports preview dismissal/removal', async () => {
  await show()
  await open()
  const user = userEvent.setup({ applyAccept: false })
  const input = screen.getByLabelText('Damage photos (optional)')
  await user.upload(
    input,
    Array.from({ length: 6 }, (_, i) => file(`${i}.png`)),
  )
  expect(await screen.findByText('Choose up to 5 images.')).toBeVisible()
  await user.upload(
    input,
    new File(['pdf'], 'bad.pdf', { type: 'application/pdf' }),
  )
  expect(
    await screen.findByText(/Choose a JPEG, PNG, or WebP image/),
  ).toBeVisible()
  await user.upload(
    input,
    new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    }),
  )
  expect(await screen.findByText(/5 MiB or smaller/)).toBeVisible()
  await user.upload(input, file())
  const preview = screen.getByRole('button', {
    name: 'Preview image 1: damage.png',
  })
  await user.click(preview)
  expect(
    await screen.findByRole('dialog', { name: 'Image preview' }),
  ).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(preview).toHaveFocus())
  expect(screen.getByRole('dialog', { name: 'Report a problem' })).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Remove image 1: damage.png' }),
  )
  expect(
    screen.queryByAltText('Selected image: damage.png'),
  ).not.toBeInTheDocument()
})

it('aborts pending creation when the resident session is revoked and ignores late success', async () => {
  let release!: () => void
  holdCreate = new Promise((resolve) => {
    release = resolve
  })
  await show()
  await open()
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }))
  await screen.findByRole('dialog', { name: 'Action in progress' })
  await act(() => clearRevokedSession(client))
  await waitFor(() => expect(creates()[0].signal?.aborted).toBe(true))
  await act(async () => {
    release()
  })
  expect(
    screen.queryByRole('dialog', { name: 'Report created successfully' }),
  ).not.toBeInTheDocument()
  expect(uploads).toBe(0)
})
