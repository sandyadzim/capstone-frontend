// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DateRangeFilter } from '@/components/date-range-filter'

it('keeps a selected calendar range local until Apply and clears both boundaries with focus restored', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  function Filter() {
    const [range, setRange] = useState({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-02',
    })
    return (
      <DateRangeFilter
        label="Reported Date"
        {...range}
        onChange={(value) => {
          onChange(value)
          setRange({
            dateFrom: value.dateFrom ?? '',
            dateTo: value.dateTo ?? '',
          })
        }}
      />
    )
  }
  render(<Filter />)
  const trigger = screen.getByRole('button', { name: 'Reported Date' })
  expect(trigger).toHaveAccessibleDescription('01 Oct 2026 – 02 Oct 2026')
  await user.click(trigger)
  await user.click(
    await screen.findByRole('button', { name: /October 3rd, 2026/ }),
  )
  expect(onChange).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Apply' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({
    dateFrom: '2026-10-01',
    dateTo: '2026-10-03',
  })
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(trigger).toHaveAccessibleDescription('01 Oct 2026 – 03 Oct 2026')
  await user.click(screen.getByRole('button', { name: 'Clear reported date' }))
  expect(onChange).toHaveBeenLastCalledWith({
    dateFrom: undefined,
    dateTo: undefined,
  })
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveAccessibleDescription('Select date range')
})

it('cancels a draft with Escape or Cancel and reopens with the URL selection', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <DateRangeFilter
      label="Reported Date"
      dateFrom="2026-10-01"
      dateTo="2026-10-02"
      onChange={onChange}
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Reported Date' })
  await user.click(trigger)
  await user.click(
    await screen.findByRole('button', { name: /October 3rd, 2026/ }),
  )
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(onChange).not.toHaveBeenCalled()
  await user.click(trigger)
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))
  expect(onChange).not.toHaveBeenCalled()
  await user.click(trigger)
  await user.click(await screen.findByRole('button', { name: 'Apply' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({
    dateFrom: '2026-10-01',
    dateTo: '2026-10-02',
  })
})

it('focuses the selected calendar day and supports arrow-key selection', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <DateRangeFilter
      label="Reported Date"
      dateFrom="2026-10-01"
      dateTo="2026-10-02"
      onChange={onChange}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Reported Date' }))
  const selected = await screen.findByRole('button', {
    name: /October 1st, 2026/,
  })
  await waitFor(() => expect(selected).toHaveFocus())
  await user.keyboard('{ArrowRight}{Enter}')
  expect(
    screen.getByRole('button', { name: /October 2nd, 2026/ }),
  ).toHaveFocus()
  expect(onChange).not.toHaveBeenCalled()
})

it('supports a single-day range and corrects an invalid incoming range through calendar selection', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <DateRangeFilter
      label="Reported Date"
      dateFrom="2026-10-11"
      dateTo="2026-10-01"
      error="Start date must be on or before end date."
      onChange={onChange}
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Reported Date' })
  expect(trigger).toHaveAttribute('aria-invalid', 'true')
  expect(trigger).toHaveAccessibleDescription(
    '11 Oct 2026 – 01 Oct 2026 Start date must be on or before end date.',
  )
  await user.click(trigger)
  expect(await screen.findByRole('button', { name: 'Apply' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /October 3rd, 2026/ }))
  await user.click(screen.getByRole('button', { name: 'Apply' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith({
    dateFrom: '2026-10-03',
    dateTo: '2026-10-03',
  })
})

it.each([
  [{ dateFrom: '2026-10-01' }, 'From 01 Oct 2026'],
  [{ dateTo: '2026-10-11' }, 'Until 11 Oct 2026'],
] as const)(
  'displays an individual URL boundary without inventing the other',
  (range, summary) => {
    render(
      <DateRangeFilter label="Reported Date" {...range} onChange={() => {}} />,
    )
    expect(
      screen.getByRole('button', { name: 'Reported Date' }),
    ).toHaveAccessibleDescription(summary)
  },
)

it.each(['Pacific/Honolulu', 'Pacific/Kiritimati'])(
  'restores external calendar dates in %s without a UTC shift',
  async (timeZone) => {
    vi.stubEnv('TZ', timeZone)
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <DateRangeFilter
        label="Reported Date"
        dateFrom="2026-10-01"
        dateTo="2026-10-02"
        onChange={onChange}
      />,
    )
    rerender(
      <DateRangeFilter
        label="Reported Date"
        dateFrom="2026-11-01"
        dateTo="2026-11-02"
        onChange={onChange}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Reported Date' })
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Apply' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-02',
    })
  },
)
