// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { InternalAxiosRequestConfig } from 'axios'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/app/query-client'
import { routeTree } from '@/routeTree.gen'
import { apiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { expireSession, sessionKey } from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'
import { technicianTaskDetailQueryOptions } from '@/features/technician/technician-queries'
import {
  completionDefaults,
  completionFileError,
  completionFormSchema,
  completionReportSchema,
  receiptFileError,
  type CompletionReport,
} from '@/features/technician/completion-schema'
import { toast } from '@/components/ui/toast'
import {
  completedReport,
  reportDetail,
  reportPage,
  photo,
} from '../admin/reports/fixtures'
import { property } from '../admin/settings/fixtures'

const actor: Actor = {
  id: '33000000-0000-4000-8000-000000000004',
  name: 'Budi',
  loginIdentifier: 'budi',
  role: 'TECHNICIAN',
}
const path = `/technician/tasks/${reportDetail.id}/complete`
const originalAdapter = apiClient.defaults.adapter
let client: ReturnType<typeof createQueryClient>
let report: CompletionReport
let requests: InternalAxiosRequestConfig[]
let failure: { step: string; error: ApiError; commit?: boolean } | undefined
let readError: ApiError | undefined
let hold: Promise<void> | undefined
let holdStep: string
let expired: boolean
const result = {
  inspectionResult: 'Checked compressor',
  problemFound: 'Loose cable',
  repairAction: 'Replaced cable',
  additionalNotes: '',
  items: [],
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(cb, 0),
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:fixture'),
      revokeObjectURL: vi.fn(),
    }),
  )
  client = createQueryClient()
  requests = []
  failure = readError = undefined
  hold = undefined
  holdStep = 'result'
  expired = false
  report = completionReportSchema.parse({
    ...reportDetail,
    status: 'IN_PROGRESS',
    assignment: { ...completedReport.assignment, technician: actor },
    costItems: [],
  })
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    const step = config.url?.split('/').at(-1) ?? ''
    let data: unknown
    if (config.url === '/auth/me') {
      if (expired) throw new ApiError('Expired', 'UNAUTHORIZED', 401)
      data = actor
    } else if (config.url === '/property') data = property
    else if (config.url === '/reports') data = reportPage([report], 1, 10)
    else if (config.url === `/reports/${report.id}`) {
      if (holdStep === 'read') await hold
      if (readError) throw readError
      data = report
    } else {
      if (holdStep === step) await hold
      const issue = failure?.step === step ? failure : undefined
      const attachment = {
        ...photo,
        id: `77000000-0000-4000-8000-${String(requests.length).padStart(12, '0')}`,
      }
      if (!issue || issue.commit) {
        if (step === 'result')
          report = {
            ...report,
            maintenanceResult: {
              ...completedReport.maintenanceResult!,
              ...JSON.parse(config.data),
            },
          }
        else if (step === 'cost-items')
          report = {
            ...report,
            costItems: JSON.parse(config.data).items.map(
              (item: object, index: number) => ({
                ...completedReport.costItems![0],
                ...item,
                id: `99000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
              }),
            ),
            totalCost: '0.01',
          }
        else if (step === 'repair-photos')
          report = {
            ...report,
            repairPhotos: [...report.repairPhotos, attachment],
          }
        else if (step === 'receipt') report = { ...report, receipt: attachment }
        else if (step === 'complete')
          report = { ...report, status: 'COMPLETED' }
        else throw new Error(`Unexpected request ${config.url}`)
      }
      if (issue) {
        if (issue.error.statusCode === 401) expired = true
        throw issue.error
      }
      data =
        step === 'repair-photos' || step === 'receipt' ? attachment : report
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  client.clear()
  toast.close()
  apiClient.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
})
function writes() {
  return requests.filter((r) => r.method !== 'get')
}
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
async function show(url = path, who: Actor | null = actor) {
  client.setQueryData(sessionKey, who)
  const router = createRouter({
    routeTree,
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: [url] }),
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
async function fill() {
  await screen.findByLabelText('Inspection findings')
  for (const [label, value] of [
    ['Inspection findings', result.inspectionResult],
    ['Problem found', result.problemFound],
    ['Repair action', result.repairAction],
  ])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: ` ${value} ` },
    })
}
function receipt() {
  return new File(['%PDF-1.7 fixture'], 'receipt.pdf', {
    type: 'application/pdf',
  })
}
function image(name = 'repair.png') {
  return new File(['image'], name, { type: 'image/png' })
}
function selectReceipt() {
  fireEvent.change(screen.getByLabelText('Choose receipt'), {
    target: { files: [receipt()] },
  })
}
async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Complete task' }))
}

it('uses the detail action to open the separate completion route and exact authenticated GET', async () => {
  const view = await show(path.replace('/complete', ''))
  const link = await screen.findByRole('link', { name: 'Complete task' })
  expect(link).toHaveAttribute('href', path)
  await userEvent.click(link)
  expect(
    await screen.findByRole('heading', { name: 'Work results', level: 1 }),
  ).toBeVisible()
  await screen.findByLabelText('Inspection findings')
  expect(view.router.state.location.pathname).toBe(path)
  const get = requests.find((r) => r.url === `/reports/${report.id}`)!
  expect(get.method).toBe('get')
  expect(get.withCredentials).toBe(true)
  expect(get.signal).toBeDefined()
})
it('validates the whole form and focuses the first required field without writes', async () => {
  await show()
  await screen.findByLabelText('Inspection findings')
  await submit()
  expect(
    await screen.findByText('Enter the inspection findings.'),
  ).toBeVisible()
  expect(screen.getByLabelText('Inspection findings')).toHaveFocus()
  expect(writes()).toHaveLength(0)
  await fill()
  await submit()
  expect(
    await screen.findByText('Choose a receipt, even when there are no costs.'),
  ).toBeVisible()
  expect(screen.getByLabelText('Choose receipt')).toHaveFocus()
  expect(writes()).toHaveLength(0)
})
it('submits the exact sequence, trimmed values, decimal strings, files and backend total', async () => {
  const view = await show()
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Add cost item' }))
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: ' Service charge ' },
  })
  expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Price'), {
    target: { value: '1,234.50' },
  })
  fireEvent.change(screen.getByLabelText('Add repair photos'), {
    target: { files: [image('one.png'), image('two.png')] },
  })
  selectReceipt()
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(view.router.state.location.pathname).toBe(
    path.replace('/complete', ''),
  )
  expect(screen.getAllByText(/awaiting administrator review/)[0]).toBeVisible()
  expect(screen.getByText(/Total cost: Rp/).textContent).toContain('0,01')
  const changes = writes()
  expect(changes.map((r) => [r.method, r.url?.split('/').at(-1)])).toEqual([
    ['put', 'result'],
    ['put', 'cost-items'],
    ['post', 'repair-photos'],
    ['post', 'repair-photos'],
    ['put', 'receipt'],
    ['post', 'complete'],
  ])
  expect(JSON.parse(changes[0].data)).toEqual({
    ...result,
    additionalNotes: null,
    items: undefined,
  })
  expect(JSON.parse(changes[1].data)).toEqual({
    items: [
      {
        type: 'SERVICE',
        description: 'Service charge',
        price: '1234.50',
      },
    ],
  })
  for (const change of changes) {
    expect(change.withCredentials).toBe(true)
    expect(change.signal).toBeDefined()
  }
  expect(changes[2].data.get('file').name).toBe('one.png')
  expect(changes[3].data.get('file').name).toBe('two.png')
  expect(changes[4].data.get('file').name).toBe('receipt.pdf')
  expect(changes[2].timeout).toBe(120_000)
  expect(changes[5].data).toBeUndefined()
})
it('prefills saved results/costs, shows saved attachments, and accepts an existing receipt', async () => {
  report = completionReportSchema.parse({
    ...completedReport,
    status: 'IN_PROGRESS',
    assignment: report.assignment,
  })
  await show()
  expect(await screen.findByLabelText('Inspection findings')).toHaveValue(
    completedReport.maintenanceResult!.inspectionResult,
  )
  expect(screen.getAllByLabelText('Price')[0]).toHaveValue('0.01')
  expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Preview receipt (opens in new tab)' }),
  ).toHaveAttribute('href', completedReport.receipt!.fileUrl)
  expect(screen.getByText('Saved photos')).toBeVisible()
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(writes().map((r) => r.url?.split('/').at(-1))).toEqual([
    'result',
    'cost-items',
    'complete',
  ])
})
it('sends an empty cost list and supports replacing a saved receipt', async () => {
  report.receipt = completedReport.receipt
  await show()
  await fill()
  fireEvent.change(screen.getByLabelText('Replace receipt (optional)'), {
    target: { files: [receipt()] },
  })
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(JSON.parse(writes()[1].data)).toEqual({ items: [] })
  expect(writes().map((r) => r.url?.split('/').at(-1))).toEqual([
    'result',
    'cost-items',
    'receipt',
    'complete',
  ])
})
it('adds/removes costs, blocks invalid decimal values before all requests', async () => {
  await show()
  await fill()
  selectReceipt()
  await userEvent.click(screen.getByRole('button', { name: 'Add cost item' }))
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Cable' },
  })
  fireEvent.change(screen.getByLabelText('Price'), {
    target: { value: '' },
  })
  await submit()
  expect(
    await screen.findByText('Use up to 21 whole digits and 2 decimals.'),
  ).toBeVisible()
  expect(screen.getByLabelText('Price')).toHaveFocus()
  expect(writes()).toHaveLength(0)
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove cost item 1' }),
  )
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(JSON.parse(writes()[1].data)).toEqual({ items: [] })
})
it.each([
  'ASSIGNED',
  'COMPLETED',
  'CLOSED',
  'VERIFIED',
  'REPORTED',
  'REJECTED',
] as const)('blocks direct completion links for %s', async (status) => {
  report.status = status
  await show()
  expect(await screen.findByText(/unavailable for completion/)).toBeVisible()
  expect(screen.queryByLabelText('Inspection findings')).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
it('rejects invalid IDs before GET and blocks missing technician cost data', async () => {
  const view = await show('/technician/tasks/not-an-id/complete')
  expect(await screen.findByText(/Invalid report ID/)).toBeVisible()
  expect(requests.filter((r) => r.url?.startsWith('/reports'))).toHaveLength(0)
  view.unmount()
  Reflect.deleteProperty(report, 'costItems')
  await show()
  expect(
    await screen.findByText(/couldn’t load the saved work information/),
  ).toBeVisible()
  expect(screen.queryByLabelText('Inspection findings')).not.toBeInTheDocument()
})
it('hides other assignments and unassigned tasks', async () => {
  report.assignment = null
  await show()
  expect(await screen.findByText(/unavailable for completion/)).toBeVisible()
  expect(screen.queryByLabelText('Inspection findings')).not.toBeInTheDocument()
})
it('shows loading and retries failed initial reads', async () => {
  const pending = deferred()
  hold = pending.promise
  holdStep = 'read'
  await show()
  expect(
    await screen.findByRole('status', { name: 'Loading work results' }),
  ).toBeVisible()
  readError = new ApiError('Offline', 'NETWORK_ERROR')
  await act(async () => pending.release())
  await screen.findByRole('button', { name: 'Retry' })
  readError = undefined
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByLabelText('Inspection findings')).toBeVisible()
})
it('retains a draft across ordinary refreshes and disables submit on read failure', async () => {
  await show()
  await fill()
  selectReceipt()
  readError = new ApiError('Offline', 'NETWORK_ERROR')
  await act(async () => {
    await client.refetchQueries({
      queryKey: technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    })
  })
  await screen.findByText(/couldn’t refresh this task/)
  expect(screen.getByLabelText('Problem found')).toHaveValue(
    ` ${result.problemFound} `,
  )
  expect(screen.getByRole('button', { name: 'Complete task' })).toBeDisabled()
  readError = undefined
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Complete task' })).toBeEnabled(),
  )
  expect(screen.getByLabelText('Problem found')).toHaveValue(
    ` ${result.problemFound} `,
  )
})
it.each([403, 404])('hides cached drafts after a %i read', async (status) => {
  await show()
  await fill()
  readError = new ApiError('Unavailable', 'FORBIDDEN', status)
  await act(async () => {
    await client.refetchQueries({
      queryKey: technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    })
  })
  await screen.findByText(/unavailable for completion/)
  expect(screen.queryByLabelText('Inspection findings')).not.toBeInTheDocument()
})
it('drops unsaved changes when cancelled', async () => {
  const view = await show()
  await fill()
  selectReceipt()
  await userEvent.click(screen.getByRole('link', { name: 'Cancel' }))
  await screen.findByRole('heading', { name: 'Task details', level: 1 })
  await act(() =>
    view.router.navigate({
      to: '/technician/tasks/$reportId/complete',
      params: { reportId: report.id },
    }),
  )
  expect(await screen.findByLabelText('Inspection findings')).toHaveValue('')
  expect(screen.queryByText('receipt.pdf')).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
it('locks pending interaction and prevents duplicate submit', async () => {
  const pending = deferred()
  hold = pending.promise
  await show()
  await fill()
  selectReceipt()
  await submit()
  expect(
    await screen.findByRole('dialog', { name: 'Action in progress' }),
  ).toBeVisible()
  expect(screen.getByText('Saving work results…')).toBeVisible()
  fireEvent.submit(
    screen.getByLabelText('Inspection findings').closest('form')!,
  )
  await userEvent.keyboard('{Escape}')
  expect(writes()).toHaveLength(1)
  expect(
    screen.getByRole('dialog', { name: 'Action in progress' }),
  ).toBeVisible()
  await act(async () => pending.release())
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(writes().filter((r) => r.url?.endsWith('/complete'))).toHaveLength(1)
})
it.each(['result', 'cost-items', 'repair-photos', 'receipt', 'complete'])(
  'stops immediately on %s failure and retains draft',
  async (step) => {
    failure = { step, error: new ApiError('Please retry', 'CONFLICT', 409) }
    await show()
    await fill()
    fireEvent.change(screen.getByLabelText('Add repair photos'), {
      target: { files: [image()] },
    })
    selectReceipt()
    await submit()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Complete task' }),
      ).toBeEnabled(),
    )
    expect(screen.getByLabelText('Repair action')).toHaveValue(
      ` ${result.repairAction} `,
    )
    expect(writes().at(-1)?.url).toBe(`/reports/${report.id}/${step}`)
    expect(screen.getAllByText('Please retry').length).toBeGreaterThan(0)
    expect(report.status).toBe('IN_PROGRESS')
  },
)
it('skips confirmed photos/receipt after later failure and keeps all editable inputs', async () => {
  failure = {
    step: 'complete',
    error: new ApiError('Conflict', 'CONFLICT', 409),
  }
  await show()
  await fill()
  fireEvent.change(screen.getByLabelText('Add repair photos'), {
    target: { files: [image()] },
  })
  selectReceipt()
  await submit()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Complete task' })).toBeEnabled(),
  )
  expect(screen.getByText('Saved photos')).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Preview receipt (opens in new tab)' }),
  ).toBeVisible()
  failure = undefined
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(
    writes().filter((r) => r.url?.endsWith('/repair-photos')),
  ).toHaveLength(1)
  expect(writes().filter((r) => r.url?.endsWith('/receipt'))).toHaveLength(1)
  expect(writes().filter((r) => r.url?.endsWith('/complete'))).toHaveLength(2)
})
it('removes an uncertain photo from the retry queue and instructs review/reselect', async () => {
  failure = {
    step: 'repair-photos',
    error: new ApiError('Timeout', 'NETWORK_ERROR'),
    commit: true,
  }
  await show()
  await fill()
  fireEvent.change(screen.getByLabelText('Add repair photos'), {
    target: { files: [image()] },
  })
  selectReceipt()
  await submit()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Complete task' })).toBeEnabled(),
  )
  expect(
    screen.getAllByText(/Check the saved attachments and reselect/).length,
  ).toBeGreaterThan(0)
  expect(screen.getByText('Saved photos')).toBeVisible()
  failure = undefined
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(
    writes().filter((r) => r.url?.endsWith('/repair-photos')),
  ).toHaveLength(1)
})
it.each([true, false])(
  'handles an uncertain receipt (saved: %s) without automatic reupload',
  async (commit) => {
    failure = {
      step: 'receipt',
      error: new ApiError('Timeout', 'NETWORK_ERROR'),
      commit,
    }
    await show()
    await fill()
    selectReceipt()
    await submit()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Complete task' }),
      ).toBeEnabled(),
    )
    expect(screen.queryByText('receipt.pdf')).not.toBeInTheDocument()
    failure = undefined
    await submit()
    if (commit)
      await screen.findByRole('region', { name: 'Completion summary' })
    else
      expect(
        await screen.findByText(
          'Choose a receipt, even when there are no costs.',
        ),
      ).toBeVisible()
    expect(writes().filter((r) => r.url?.endsWith('/receipt'))).toHaveLength(1)
  },
)
it('reconciles an uncertain completed response as success without another POST', async () => {
  failure = {
    step: 'complete',
    error: new ApiError('Timeout', 'NETWORK_ERROR'),
    commit: true,
  }
  await show()
  await fill()
  selectReceipt()
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(writes().filter((r) => r.url?.endsWith('/complete'))).toHaveLength(1)
  expect(
    requests.filter(
      (r) => r.method === 'get' && r.url === `/reports/${report.id}`,
    ).length,
  ).toBeGreaterThan(1)
})
it('blocks another submission until an uncertain completion read succeeds', async () => {
  await show()
  await fill()
  selectReceipt()
  failure = {
    step: 'complete',
    error: new ApiError('Timeout', 'NETWORK_ERROR'),
    commit: true,
  }
  readError = new ApiError('Offline', 'NETWORK_ERROR')
  await submit()
  await screen.findByRole('button', { name: 'Retry' })
  expect(screen.getByRole('button', { name: 'Complete task' })).toBeDisabled()
  readError = undefined
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText(/unavailable for completion/)).toBeVisible()
  expect(writes().filter((r) => r.url?.endsWith('/complete'))).toHaveLength(1)
})
it('associates server validation errors and focuses the relevant field', async () => {
  failure = {
    step: 'result',
    error: new ApiError('Fix findings', 'VALIDATION_ERROR', 400, {
      issues: [{ path: ['problemFound'], message: 'Explain the problem.' }],
    }),
  }
  await show()
  await fill()
  selectReceipt()
  await submit()
  expect(await screen.findByText('Explain the problem.')).toBeVisible()
  await waitFor(() =>
    expect(screen.getByLabelText('Problem found')).toHaveFocus(),
  )
  expect(screen.getByLabelText('Problem found')).toHaveAccessibleDescription(
    'Explain the problem.',
  )
})
it.each([403, 404])(
  'hides the form after a %i mutation failure',
  async (status) => {
    failure = {
      step: 'result',
      error: new ApiError('Unavailable', 'FORBIDDEN', status),
    }
    await show()
    await fill()
    selectReceipt()
    await submit()
    expect(await screen.findByText(/unavailable for completion/)).toBeVisible()
    expect(writes()).toHaveLength(1)
  },
)
it('expires the session after a private 401 without later writes', async () => {
  failure = {
    step: 'result',
    error: new ApiError('Expired', 'UNAUTHORIZED', 401),
  }
  await show()
  await fill()
  selectReceipt()
  await submit()
  await waitFor(() => expect(client.getQueryData(sessionKey)).toBeNull())
  expect(
    client.getQueryData(
      technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    ),
  ).toBeUndefined()
  expect(writes()).toHaveLength(1)
})
it('aborts on unmount and forces a fresh read after an uncertain saved request', async () => {
  const pending = deferred()
  hold = pending.promise
  const view = await show()
  await fill()
  selectReceipt()
  await submit()
  const request = writes()[0]
  view.unmount()
  expect(request.signal?.aborted).toBe(true)
  expect(
    client.getQueryState(
      technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    )?.isInvalidated,
  ).toBe(true)
  await act(async () => pending.release())
  expect(writes()).toHaveLength(1)
  expect(
    client.getQueryData<CompletionReport>(
      technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    )?.maintenanceResult,
  ).toBeNull()
})
it('suppresses late cache updates when the session changes', async () => {
  const pending = deferred()
  hold = pending.promise
  await show()
  await fill()
  selectReceipt()
  await submit()
  await act(async () => {
    await expireSession(client)
    client.setQueryData(sessionKey, {
      ...actor,
      id: '33000000-0000-4000-8000-000000000099',
    })
    pending.release()
  })
  expect(writes()).toHaveLength(1)
  expect(
    client.getQueryData(
      technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    ),
  ).toBeUndefined()
})
it('limits repair photos to five including saved photos and validates receipt choices', async () => {
  report.repairPhotos = Array.from({ length: 5 }, (_, i) => ({
    ...photo,
    id: `77000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  }))
  await show()
  await fill()
  expect(screen.queryByLabelText('Add repair photos')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Choose receipt'), {
    target: { files: [new File(['bad'], 'x.txt', { type: 'text/plain' })] },
  })
  expect(
    await screen.findByText('Choose a JPEG, PNG, WebP image or PDF.'),
  ).toBeVisible()
  await submit()
  expect(writes()).toHaveLength(0)
})

it.each(['01', '-1', '1e3', '1000000000000000000000', '1.001'])(
  'rejects invalid price %s',
  (price) => {
    expect(
      completionFormSchema.safeParse({
        ...result,
        items: [{ type: 'MATERIAL', description: 'x', price }],
      }).success,
    ).toBe(false)
  },
)
it('preserves allowed decimal precision and trims text without numeric conversion', () => {
  const values = completionFormSchema.parse({
    ...result,
    inspectionResult: ' Check ',
    items: [
      {
        type: 'SERVICE',
        description: ' x ',
        price: '999999999999999999999.99',
      },
    ],
  })
  expect(values.inspectionResult).toBe('Check')
  expect(values.items[0]).toEqual({
    type: 'SERVICE',
    description: 'x',
    price: '999999999999999999999.99',
  })
  expect(completionDefaults(report).items).toEqual([])
})
it('validates receipt size/type, all repair limits, and saved receipt satisfaction', () => {
  expect(
    receiptFileError(new File([], 'x.pdf', { type: 'application/pdf' })),
  ).toMatch(/non-empty/)
  expect(
    receiptFileError(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'x.pdf', {
        type: 'application/pdf',
      }),
    ),
  ).toMatch(/5 MiB/)
  expect(receiptFileError(receipt())).toBeUndefined()
  expect(
    completionFileError(
      report,
      [new File(['x'], 'x.gif', { type: 'image/gif' })],
      receipt(),
    )?.field,
  ).toBe('photos')
  expect(
    completionFileError(
      { ...report, repairPhotos: [photo] },
      Array.from({ length: 5 }, () => image()),
      receipt(),
    )?.message,
  ).toMatch(/including saved/)
  expect(completionFileError({ ...report, receipt: photo }, [])).toBeUndefined()
})

it('stops a later photo upload and skips the first confirmed photo on retry', async () => {
  const adapter = apiClient.defaults.adapter
  if (typeof adapter !== 'function') throw new Error('Fixture adapter missing')
  let uploads = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/repair-photos') && ++uploads === 2) {
      requests.push(config)
      throw new ApiError('Second photo rejected', 'VALIDATION_ERROR', 400)
    }
    return adapter(config)
  }
  await show()
  await fill()
  fireEvent.change(screen.getByLabelText('Add repair photos'), {
    target: {
      files: [image('first.png'), image('second.png'), image('third.png')],
    },
  })
  selectReceipt()
  await submit()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Complete task' })).toBeEnabled(),
  )
  expect(writes().map((r) => r.url?.split('/').at(-1))).toEqual([
    'result',
    'cost-items',
    'repair-photos',
    'repair-photos',
  ])
  expect(report.repairPhotos).toHaveLength(1)
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(
    writes()
      .filter((r) => r.url?.endsWith('/repair-photos'))
      .map((r) => r.data.get('file').name),
  ).toEqual(['first.png', 'second.png', 'second.png', 'third.png'])
})
it('hides the draft after a conflicting status or ownership change on refresh', async () => {
  await show()
  await fill()
  report.status = 'COMPLETED'
  await act(async () => {
    await client.refetchQueries({
      queryKey: technicianTaskDetailQueryOptions(actor.id, report.id).queryKey,
    })
  })
  expect(await screen.findByText(/unavailable for completion/)).toBeVisible()
  expect(screen.queryByLabelText('Inspection findings')).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
it('rejects malformed successful responses before continuing the write sequence', async () => {
  const adapter = apiClient.defaults.adapter
  if (typeof adapter !== 'function') throw new Error('Fixture adapter missing')
  apiClient.defaults.adapter = async (config) => {
    const response = await adapter(config)
    return config.url?.endsWith('/result')
      ? { ...response, data: { ...response.data, costItems: undefined } }
      : response
  }
  await show()
  await fill()
  selectReceipt()
  await submit()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Complete task' })).toBeEnabled(),
  )
  expect(writes()).toHaveLength(1)
  expect(screen.getByLabelText('Repair action')).toHaveValue(
    ` ${result.repairAction} `,
  )
})
it('displays exact large backend totals after completion without floating-point rounding', async () => {
  report.status = 'COMPLETED'
  report.totalCost = '999999999999999999.25'
  await show(path.replace('/complete', ''))
  expect(await screen.findByText(/Total cost:/)).toHaveTextContent(
    '999.999.999.999.999.999,25',
  )
})

it('accepts a zero-price charge and associates backend price errors with Price', async () => {
  failure = {
    step: 'cost-items',
    error: new ApiError('Check price', 'VALIDATION_ERROR', 400, {
      issues: [{ path: ['items', '0', 'price'], message: 'Check this price.' }],
    }),
  }
  await show()
  await fill()
  selectReceipt()
  await userEvent.click(screen.getByRole('button', { name: 'Add cost item' }))
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'No-charge service' },
  })
  fireEvent.change(screen.getByLabelText('Price'), {
    target: { value: '0.00' },
  })
  await submit()
  expect(await screen.findByText('Check this price.')).toBeVisible()
  await waitFor(() => expect(screen.getByLabelText('Price')).toHaveFocus())
  expect(JSON.parse(writes()[1].data)).toEqual({
    items: [
      {
        type: 'SERVICE',
        description: 'No-charge service',
        price: '0.00',
      },
    ],
  })
})

it('preserves the largest supported item price through the formatted field and request', async () => {
  await show()
  await fill()
  selectReceipt()
  await userEvent.click(screen.getByRole('button', { name: 'Add cost item' }))
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Legacy large charge' },
  })
  fireEvent.change(screen.getByLabelText('Price'), {
    target: { value: '999999999999999999999.99' },
  })
  expect(screen.getByLabelText('Price')).toHaveValue(
    '999,999,999,999,999,999,999.99',
  )
  await submit()
  await screen.findByRole('region', { name: 'Completion summary' })
  expect(JSON.parse(writes()[1].data)).toEqual({
    items: [
      {
        type: 'SERVICE',
        description: 'Legacy large charge',
        price: '999999999999999999999.99',
      },
    ],
  })
})
