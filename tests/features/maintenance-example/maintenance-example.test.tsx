// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'
import { MaintenanceExample } from '@/features/maintenance-example/maintenance-example'
import { apiClient } from '@/lib/api/client'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('shows accessible validation errors and focuses the first invalid field', async () => {
  const user = userEvent.setup()
  render(<MaintenanceExample />)
  await user.click(screen.getByRole('button', { name: 'Preview submission' }))
  expect(
    await screen.findByText('Enter a title with at least 5 characters.'),
  ).toBeVisible()
  expect(
    screen.getByText('Describe the issue in at least 10 characters.'),
  ).toBeVisible()
  const title = screen.getByRole('textbox', { name: 'Request title' })
  const description = screen.getByRole('textbox', { name: 'Description' })
  expect(title).toHaveAttribute('aria-invalid', 'true')
  expect(title).toHaveAccessibleDescription(
    expect.stringContaining('Enter a title with at least 5 characters.'),
  )
  expect(description).toHaveAccessibleDescription(
    expect.stringContaining('Describe the issue in at least 10 characters.'),
  )
  await waitFor(() => expect(title).toHaveFocus())
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('moves focus to the description when only that field is invalid', async () => {
  const user = userEvent.setup()
  render(<MaintenanceExample />)
  await user.type(
    screen.getByRole('textbox', { name: 'Request title' }),
    'Leaking tap',
  )
  await user.click(screen.getByRole('button', { name: 'Preview submission' }))
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveFocus(),
  )
  expect(
    screen.queryByText('Enter a title with at least 5 characters.'),
  ).not.toBeInTheDocument()
})

it.each(['Request title', 'Description'])(
  'previews trimmed local values and clears the preview when %s is edited',
  async (field) => {
    const request = vi
      .fn<AxiosAdapter>()
      .mockRejectedValue(new Error('The example must stay local'))
    apiClient.defaults.adapter = request
    const user = userEvent.setup()
    render(<MaintenanceExample />)
    await user.type(
      screen.getByRole('textbox', { name: 'Request title' }),
      '  Leaking tap  ',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      '  The kitchen tap leaks.  ',
    )
    await user.click(screen.getByRole('button', { name: 'Preview submission' }))
    const status = screen.getByRole('status')
    expect(await within(status).findByText('Example validated')).toBeVisible()
    expect(within(status).getByText('Leaking tap')).toHaveTextContent(
      /^Leaking tap$/,
    )
    expect(
      within(status).getByText('The kitchen tap leaks.'),
    ).toHaveTextContent(/^The kitchen tap leaks\.$/)
    expect(
      within(status).getByText(
        'This is a local preview. No request was created.',
      ),
    ).toBeVisible()
    expect(request).not.toHaveBeenCalled()
    await user.type(screen.getByRole('textbox', { name: field }), '!')
    expect(status).toBeEmptyDOMElement()
  },
)

it('resets values, validation errors, and the preview', async () => {
  const user = userEvent.setup()
  render(<MaintenanceExample />)
  const title = screen.getByRole('textbox', { name: 'Request title' })
  const description = screen.getByRole('textbox', { name: 'Description' })
  const preview = screen.getByRole('button', { name: 'Preview submission' })
  const reset = screen.getByRole('button', { name: 'Reset' })
  await user.click(preview)
  await screen.findByText('Enter a title with at least 5 characters.')
  await user.click(reset)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(title).toHaveAttribute('aria-invalid', 'false')
  expect(description).toHaveAttribute('aria-invalid', 'false')
  await user.type(title, 'Leaking tap')
  await user.type(description, 'The kitchen tap leaks.')
  await user.click(preview)
  await screen.findByText('Example validated')
  await user.click(reset)
  expect(title).toHaveValue('')
  expect(description).toHaveValue('')
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('supports keyboard submission from the title field', async () => {
  const user = userEvent.setup()
  render(<MaintenanceExample />)
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'The kitchen tap leaks.',
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Request title' }),
    'Leaking tap{Enter}',
  )
  expect(await screen.findByText('Example validated')).toBeVisible()
})
