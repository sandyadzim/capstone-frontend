// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { FullScreenLoader } from '@/components/full-screen-loader'

it('locks focus until the action finishes, announces generic loading, and restores the page', async () => {
  const view = (open: boolean) => (
    <>
      <button>Background action</button>
      <FullScreenLoader open={open} />
    </>
  )
  const { rerender } = render(view(false))
  const user = userEvent.setup()
  const background = screen.getByRole('button', { name: 'Background action' })
  await user.click(background)
  rerender(view(true))
  const loader = await screen.findByRole('dialog', {
    name: 'Action in progress',
  })
  await waitFor(() =>
    expect(loader.contains(document.activeElement)).toBe(true),
  )
  expect(within(loader).getByRole('status')).toHaveTextContent('Loading…')
  expect(within(loader).queryByRole('button')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Background action' }),
  ).not.toBeInTheDocument()
  await user.keyboard('{Tab}{Shift>}{Tab}{/Shift}{Escape}')
  expect(screen.getByRole('dialog', { name: 'Action in progress' })).toBe(
    loader,
  )
  expect(loader.contains(document.activeElement)).toBe(true)
  rerender(view(true))
  expect(within(loader).getByRole('status')).toHaveTextContent('Loading…')
  rerender(view(false))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(background).toHaveFocus())
  expect(
    screen.getByRole('button', { name: 'Background action' }),
  ).toBeEnabled()
})
