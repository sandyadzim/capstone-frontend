// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { FullScreenLoader } from '@/components/full-screen-loader'

it('locks focus until the action finishes, announces updates, and restores the page', async () => {
  const view = (open: boolean, message: string) => (
    <>
      <button>Background action</button>
      <FullScreenLoader open={open} message={message} />
    </>
  )
  const { rerender } = render(view(false, 'Saving changes…'))
  const user = userEvent.setup()
  const background = screen.getByRole('button', { name: 'Background action' })
  await user.click(background)
  rerender(view(true, 'Saving changes…'))
  const loader = await screen.findByRole('dialog', {
    name: 'Action in progress',
  })
  await waitFor(() =>
    expect(loader.contains(document.activeElement)).toBe(true),
  )
  expect(within(loader).getByRole('status')).toHaveTextContent(
    'Saving changes…',
  )
  expect(within(loader).queryByRole('button')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Background action' }),
  ).not.toBeInTheDocument()
  await user.keyboard('{Tab}{Shift>}{Tab}{/Shift}{Escape}')
  expect(screen.getByRole('dialog', { name: 'Action in progress' })).toBe(
    loader,
  )
  expect(loader.contains(document.activeElement)).toBe(true)
  rerender(view(true, 'Uploading image…'))
  expect(within(loader).getByRole('status')).toHaveTextContent(
    'Uploading image…',
  )
  rerender(view(false, 'Uploading image…'))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(background).toHaveFocus())
  expect(
    screen.getByRole('button', { name: 'Background action' }),
  ).toBeEnabled()
})
