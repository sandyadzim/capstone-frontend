// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Pagination } from '@/components/pagination'

it('shows totals and supports page numbers, chevrons and an accessible page-size select', async () => {
  const user = userEvent.setup()
  const page = vi.fn()
  const size = vi.fn()
  render(
    <Pagination
      meta={{ page: 2, pageSize: 20, total: 45, totalPages: 3 }}
      onPageChange={page}
      onPageSizeChange={size}
    />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('Total 45')
  expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await user.click(screen.getByRole('button', { name: 'Go to page 3' }))
  expect(page).toHaveBeenCalledWith(3)
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(page).toHaveBeenCalledWith(3)
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  expect(page).toHaveBeenCalledWith(1)
  screen.getByRole('combobox', { name: 'Page size' }).focus()
  await user.keyboard('{ArrowDown}')
  await user.click(await screen.findByRole('option', { name: '50' }))
  expect(size).toHaveBeenCalledWith(50)
})
it('handles empty lists and unavailable navigation', () => {
  render(
    <Pagination
      meta={{ page: 1, pageSize: 20, total: 0, totalPages: 0 }}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('Total 0')
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: /Go to page/ }),
  ).not.toBeInTheDocument()
})
it.each([
  [1, [1, 2, 20]],
  [10, [1, 10, 20]],
  [20, [1, 19, 20]],
])(
  'keeps the current, first and last page reachable in long lists at page %i',
  async (current, visible) => {
    const page = vi.fn()
    const user = userEvent.setup()
    render(
      <Pagination
        meta={{ page: current, pageSize: 10, total: 200, totalPages: 20 }}
        onPageChange={page}
        onPageSizeChange={vi.fn()}
      />,
    )
    expect(
      screen
        .getAllByRole('button', { name: /Go to page/ })
        .map((button) => Number(button.textContent)),
    ).toEqual(visible)
    expect(
      screen.getByRole('button', { name: `Go to page ${current}` }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      document.querySelector('[data-slot="pagination-ellipsis"]'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to page 20' }))
    expect(page).toHaveBeenCalledWith(20)
  },
)
it('prevents page and size changes while updating', () => {
  render(
    <Pagination
      disabled
      meta={{ page: 2, pageSize: 20, total: 60, totalPages: 3 }}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />,
  )
  for (const button of screen.getAllByRole('button'))
    expect(button).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Page size' })).toBeDisabled()
})
