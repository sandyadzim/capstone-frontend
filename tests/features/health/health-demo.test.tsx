// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HealthDemo } from '@/features/health/health-demo'
import { apiClient } from '@/lib/api/client'

let client: QueryClient
const originalAdapter = apiClient.defaults.adapter

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, gcTime: Infinity } },
  })
})

afterEach(() => {
  client.clear()
  apiClient.defaults.adapter = originalAdapter
})

function renderDemo() {
  return render(
    <QueryClientProvider client={client}>
      <HealthDemo />
    </QueryClientProvider>,
  )
}

function successAdapter(data: unknown = { status: 'ok' }) {
  return vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
}

it('waits for manual keyboard activation, disables duplicate checks, then displays success', async () => {
  let finish: (() => void) | undefined
  const adapter = vi.fn<AxiosAdapter>((config) => {
    expect(config.signal).toBeInstanceOf(AbortSignal)
    return new Promise<AxiosResponse>((resolve) => {
      finish = () =>
        resolve({
          data: { status: 'ok' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        })
    })
  })
  apiClient.defaults.adapter = adapter
  const user = userEvent.setup()
  renderDemo()
  expect(screen.getByText('Connection has not been checked yet.')).toBeVisible()
  expect(adapter).not.toHaveBeenCalled()
  await user.tab()
  expect(
    screen.getByRole('button', { name: 'Check API connection' }),
  ).toHaveFocus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(adapter).toHaveBeenCalledOnce())
  expect(
    await screen.findByRole('button', { name: 'Checking…' }),
  ).toBeDisabled()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Checking API connection…')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Checking…' }))
  expect(adapter).toHaveBeenCalledOnce()
  await act(async () => {
    if (!finish) throw new Error('Request did not start')
    finish()
  })
  expect(await screen.findByText('API is connected.')).toBeVisible()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false')
  expect(screen.getByRole('status')).toHaveTextContent('"status": "ok"')
  expect(
    screen.getByRole('button', { name: 'Check API connection' }),
  ).toBeEnabled()
})

it('shows a normalized failure without automatic retry and recovers on explicit retry', async () => {
  const adapter = successAdapter()
  adapter.mockRejectedValueOnce(new AxiosError('Network failed', 'ERR_NETWORK'))
  apiClient.defaults.adapter = adapter
  const user = userEvent.setup()
  renderDemo()
  await user.click(screen.getByRole('button', { name: 'Check API connection' }))
  expect(
    await screen.findByText(
      'Cannot reach the API. Check your connection and try again.',
    ),
  ).toBeVisible()
  expect(adapter).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false')
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('API is connected.')).toBeVisible()
  expect(adapter).toHaveBeenCalledTimes(2)
})

it('shows a contract error instead of treating an invalid health body as success', async () => {
  apiClient.defaults.adapter = successAdapter({ status: 'down' })
  const user = userEvent.setup()
  renderDemo()
  await user.click(screen.getByRole('button', { name: 'Check API connection' }))
  expect(
    await screen.findByText(
      'The API returned an unexpected health response. Try again.',
    ),
  ).toBeVisible()
  expect(screen.queryByText('API is connected.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
})

it('retains the shared result across mounts and sends another request only on activation', async () => {
  const adapter = successAdapter()
  apiClient.defaults.adapter = adapter
  const user = userEvent.setup()
  const view = renderDemo()
  await user.click(screen.getByRole('button', { name: 'Check API connection' }))
  await screen.findByText('API is connected.')
  view.unmount()
  renderDemo()
  expect(screen.getByText('API is connected.')).toBeVisible()
  expect(adapter).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: 'Check API connection' }))
  await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false'),
  )
})
