// @vitest-environment jsdom
import { useRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { NumberInput } from '@/components/number-input'

function Example({
  initial = '',
  disabled = false,
  maxFractionDigits = 2,
}: {
  initial?: string
  disabled?: boolean
  maxFractionDigits?: number
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <label htmlFor="amount">Price</label>
      <NumberInput
        id="amount"
        ref={ref}
        value={value}
        onValueChange={setValue}
        prefix="IDR"
        disabled={disabled}
        maxFractionDigits={maxFractionDigits}
        aria-describedby="amount-help"
      />
      <p id="amount-help">Enter a price.</p>
      <output data-testid="value">{value}</output>
      <button onClick={() => ref.current?.focus()}>Focus price</button>
    </>
  )
}
it('formats typing with thousands separators and exposes an unformatted decimal string', async () => {
  render(<Example />)
  const user = userEvent.setup(),
    input = screen.getByLabelText('Price')
  await user.type(input, '1234567.50')
  expect(input).toHaveValue('1,234,567.50')
  expect(screen.getByTestId('value')).toHaveTextContent('1234567.50')
  expect(input).toHaveAttribute('inputmode', 'decimal')
  expect(input).toHaveAccessibleDescription('IDR Enter a price.')
})
it('formats saved decimal strings and keeps trailing fractional zeros', () => {
  render(<Example initial="999999999999.00" />)
  expect(screen.getByLabelText('Price')).toHaveValue('999,999,999,999.00')
  expect(screen.getByTestId('value')).toHaveTextContent('999999999999.00')
})
it('supports clearing, zero, decimal-first typing and leading zeros', async () => {
  render(<Example />)
  const user = userEvent.setup(),
    input = screen.getByLabelText('Price')
  await user.type(input, '0001000')
  expect(input).toHaveValue('1,000')
  await user.clear(input)
  expect(screen.getByTestId('value')).toBeEmptyDOMElement()
  await user.type(input, '.05')
  expect(input).toHaveValue('0.05')
  await user.clear(input)
  await user.type(input, '0.00')
  expect(screen.getByTestId('value')).toHaveTextContent('0.00')
})
it('rejects letters, negatives, exponents and extra precision without rounding', async () => {
  render(<Example />)
  const user = userEvent.setup(),
    input = screen.getByLabelText('Price')
  await user.type(input, '-abc1e.234')
  expect(input).toHaveValue('1.23')
  expect(screen.getByTestId('value')).toHaveTextContent('1.23')
  await user.clear(input)
  await user.type(input, '1234567890123')
  expect(input).toHaveValue('123,456,789,012')
  expect(screen.getByTestId('value')).toHaveTextContent('123456789012')
})
it('supports formatted paste and rejects invalid pasted text', async () => {
  render(<Example />)
  const user = userEvent.setup(),
    input = screen.getByLabelText('Price')
  await user.click(input)
  await user.paste('1,234.50')
  expect(input).toHaveValue('1,234.50')
  expect(screen.getByTestId('value')).toHaveTextContent('1234.50')
  await user.clear(input)
  await user.paste('IDR invalid')
  expect(input).toHaveValue('')
})
it('keeps the caret near middle edits and deletes across separators', async () => {
  render(<Example initial="1000" />)
  const user = userEvent.setup(),
    input = screen.getByLabelText<HTMLInputElement>('Price')
  await user.click(input)
  input.setSelectionRange(2, 2)
  await user.keyboard('9')
  expect(input).toHaveValue('19,000')
  expect(input.selectionStart).toBe(2)
  input.setSelectionRange(3, 3)
  await user.keyboard('{Backspace}')
  expect(input).toHaveValue('1,000')
  input.setSelectionRange(1, 1)
  await user.keyboard('{Delete}')
  expect(input).toHaveValue('100')
})
it('forwards field refs and supports integer-only configuration', async () => {
  render(<Example maxFractionDigits={0} />)
  const user = userEvent.setup(),
    input = screen.getByLabelText('Price')
  await user.click(screen.getByRole('button', { name: 'Focus price' }))
  expect(input).toHaveFocus()
  expect(input).toHaveAttribute('inputmode', 'numeric')
  await user.keyboard('1000.5')
  expect(input).toHaveValue('10,005')
})
it('preserves disabled input behavior', async () => {
  render(<Example initial="1000" disabled />)
  await userEvent.type(screen.getByLabelText('Price'), '2')
  expect(screen.getByLabelText('Price')).toBeDisabled()
  expect(screen.getByLabelText('Price')).toHaveValue('1,000')
})
