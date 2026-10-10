// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import {
  ListFilters,
  SearchFilter,
  SelectFilter,
} from '@/components/list-filters'

function Filters() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  return (
    <ListFilters
      search={
        <SearchFilter
          label="Search records"
          placeholder="Search records"
          value={search}
          onChange={setSearch}
        />
      }
    >
      <SelectFilter
        label="Status"
        placeholder="Status"
        value={status}
        onChange={setStatus}
        clearable
        options={[
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ]}
      />
      <SelectFilter
        label="Default status"
        placeholder="Default status"
        value="open"
        onChange={() => {}}
        options={[{ value: 'open', label: 'Open' }]}
      />
    </ListFilters>
  )
}
it('associates visible labels with each filter and has no reset footer', () => {
  render(<Filters />)
  expect(
    screen.getByRole('searchbox', { name: 'Search records' }),
  ).toHaveAttribute('placeholder', 'Search records')
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
    'Status',
  )
  expect(screen.getByLabelText('Search records')).toBe(
    screen.getByRole('searchbox'),
  )
  expect(screen.getByLabelText('Status')).toBe(
    screen.getByRole('combobox', { name: 'Status' }),
  )
  expect(
    screen.getByText('Default status', { selector: 'label' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Reset filters' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Clear default status' }),
  ).not.toBeInTheDocument()
})
it('clears only the search field and restores input focus', async () => {
  const user = userEvent.setup()
  render(<Filters />)
  const input = screen.getByRole('searchbox', { name: 'Search records' })
  await user.type(input, ' A 10 ')
  expect(input).toHaveValue(' A 10 ')
  await user.click(screen.getByRole('button', { name: 'Clear search records' }))
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  expect(
    screen.queryByRole('button', { name: 'Clear search records' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('combobox', { name: 'Default status' }),
  ).toHaveTextContent('Open')
})
it('clears an optional selection back to its placeholder and restores trigger focus', async () => {
  const user = userEvent.setup()
  render(<Filters />)
  const select = screen.getByRole('combobox', { name: 'Status' })
  select.focus()
  await user.keyboard('{ArrowDown}')
  await user.click(await screen.findByRole('option', { name: 'Closed' }))
  expect(select).toHaveTextContent('Closed')
  const clear = screen.getByRole('button', { name: 'Clear status' })
  // Clear stays a sibling control rather than nesting a button in the trigger.
  expect(select).not.toContainElement(clear)
  clear.focus()
  await user.keyboard('{Enter}')
  expect(select).toHaveTextContent('Status')
  expect(select).toHaveFocus()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Clear status' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('combobox', { name: 'Default status' }),
  ).toHaveTextContent('Open')
})
it('disables editing and clearing while a filter is unavailable', () => {
  render(
    <>
      <SearchFilter
        label="Search"
        placeholder="Search"
        value="A"
        onChange={() => {}}
        disabled
      />
      <SelectFilter
        label="Status"
        placeholder="Status"
        value="open"
        onChange={() => {}}
        clearable
        disabled
        options={[{ value: 'open', label: 'Open' }]}
      />
    </>,
  )
  expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Status' })).toBeDisabled()
  for (const button of screen.getAllByRole('button'))
    expect(button).toBeDisabled()
})
