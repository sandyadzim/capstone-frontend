// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DataTable, type DataColumn } from '@/components/data-table'

type Record = { id: string; title: string; count: number }
const records: Record[] = [
  { id: 'record-1', title: 'Pump inspection', count: 2 },
]
const columns: DataColumn<Record>[] = [
  { id: 'title', header: 'Title', cell: (record) => record.title },
  { id: 'count', header: 'Count', cell: (record) => record.count },
]
const props = {
  label: 'Inspections',
  rows: records,
  columns,
  rowId: (record: Record) => record.id,
}

it('renders unrelated record types with desktop headers and labeled mobile values', () => {
  render(<DataTable {...props} />)
  const table = screen.getByRole('table', { name: 'Inspections' })
  expect(
    within(table).getByRole('columnheader', { name: 'Title' }),
  ).toBeVisible()
  expect(
    within(table).getByRole('cell', { name: 'Pump inspection' }),
  ).toBeVisible()
  const mobile = screen.getByRole('list', { name: 'Inspections records' })
  expect(within(mobile).getByText('Title', { selector: 'dt' })).toBeVisible()
  expect(
    within(mobile).getByText('Pump inspection', { selector: 'dd' }),
  ).toBeVisible()
  expect(within(mobile).getByText('Count', { selector: 'dt' })).toBeVisible()
  expect(within(mobile).getByText('2', { selector: 'dd' })).toBeVisible()
})

it('accepts feature-owned mobile content without changing the desktop columns', async () => {
  const open = vi.fn()
  const user = userEvent.setup()
  render(
    <DataTable
      {...props}
      mobileRecord={(record) => (
        <button onClick={() => open(record.id)}>Open {record.title}</button>
      )}
    />,
  )
  expect(screen.getByRole('cell', { name: '2' })).toBeVisible()
  const mobile = screen.getByRole('list', { name: 'Inspections records' })
  expect(within(mobile).queryByText('Count')).not.toBeInTheDocument()
  await user.click(
    within(mobile).getByRole('button', { name: 'Open Pump inspection' }),
  )
  expect(open).toHaveBeenCalledWith('record-1')
})

it('retains records during refresh and exposes retry after a read error', async () => {
  const retry = vi.fn()
  const user = userEvent.setup()
  const { rerender } = render(
    <DataTable {...props} updating error="Connection lost." onRetry={retry} />,
  )
  expect(screen.getByRole('region', { name: 'Inspections' })).toHaveAttribute(
    'aria-busy',
    'true',
  )
  expect(screen.getByRole('status')).toHaveTextContent('Updating inspections…')
  expect(screen.getByRole('status')).toHaveClass('sr-only')
  expect(screen.getByRole('cell', { name: 'Pump inspection' })).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent('Connection lost.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  expect(retry).not.toHaveBeenCalled()
  rerender(<DataTable {...props} error="Connection lost." onRetry={retry} />)
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('shows one loading announcement before an empty result', () => {
  const { rerender } = render(<DataTable {...props} loading />)
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('Loading inspections…')
  expect(screen.getByRole('status')).toHaveClass('sr-only')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  rerender(
    <DataTable {...props} rows={[]} emptyMessage="No inspections scheduled." />,
  )
  expect(screen.getByRole('status')).toHaveTextContent(
    'No inspections scheduled.',
  )
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

it('shows the pinned-column divider only while content overflows and responds to resizing', () => {
  let resize: (() => void) | undefined
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  try {
    const { unmount } = render(
      <DataTable
        {...props}
        columns={[
          ...columns,
          {
            id: 'actions',
            header: 'Actions',
            sticky: 'right',
            cell: () => <button>View</button>,
          },
        ]}
      />,
    )
    const area = screen.getByRole('region', { name: 'Inspections scroll area' })
    let availableWidth = 600
    Object.defineProperties(area, {
      scrollWidth: { get: () => 450 },
      clientWidth: { get: () => availableWidth },
    })
    const header = screen.getByRole('columnheader', { name: 'Actions' })
    const cell = screen.getByRole('cell', { name: 'View' })
    expect(header.style.minWidth).toBe('')
    expect(cell.style.minWidth).toBe('')
    expect(header.style.width).toBe('1px')
    const title = screen.getByRole('columnheader', { name: 'Title' })
    expect(title.style.minWidth).toBe('150px')
    expect(title.style.width).toBe('')
    act(() => resize?.())
    expect(header).not.toHaveClass('border-l')
    expect(cell).not.toHaveClass('border-l')
    availableWidth = 400
    act(() => resize?.())
    expect(header).toHaveClass('sticky', 'right-0', 'border-l')
    expect(cell).toHaveClass('sticky', 'right-0', 'border-l')
    availableWidth = 600
    act(() => resize?.())
    expect(header).not.toHaveClass('border-l')
    expect(cell).not.toHaveClass('border-l')
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})
