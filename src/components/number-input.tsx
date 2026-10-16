import { useId, type ComponentProps } from 'react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'

type NumberInputProps = Omit<
  ComponentProps<'input'>,
  'type' | 'inputMode' | 'value' | 'defaultValue' | 'onChange'
> & {
  /** Unformatted decimal string, for example "1234.50". */
  value: string
  onValueChange: (value: string) => void
  prefix?: string
  maxIntegerDigits?: number
  maxFractionDigits?: number
}

function formatNumber(value: string) {
  const [whole, fraction] = value.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

function caretPosition(formatted: string, digitsBeforeCaret: number) {
  if (!digitsBeforeCaret) return 0
  let count = 0
  for (let index = 0; index < formatted.length; index++) {
    if (formatted[index] !== ',') count++
    if (count === digitsBeforeCaret) return index + 1
  }
  return formatted.length
}

export function NumberInput({
  value,
  onValueChange,
  prefix,
  maxIntegerDigits = 12,
  maxFractionDigits = 2,
  className,
  onKeyDown,
  disabled,
  ...props
}: NumberInputProps) {
  const prefixId = useId()
  return (
    <div className="relative min-w-0">
      {prefix && (
        <span
          id={prefixId}
          className={cn(
            'pointer-events-none absolute inset-y-px left-px flex w-12 items-center justify-center border-r border-input text-sm text-muted-foreground',
            disabled && 'opacity-50',
          )}
        >
          {prefix}
        </span>
      )}
      <Input
        {...props}
        aria-describedby={
          [prefix ? prefixId : undefined, props['aria-describedby']]
            .filter(Boolean)
            .join(' ') || undefined
        }
        type="text"
        inputMode={maxFractionDigits ? 'decimal' : 'numeric'}
        disabled={disabled}
        value={formatNumber(value)}
        className={cn('min-h-11 tabular-nums', prefix && 'pl-14', className)}
        onChange={(event) => {
          const input = event.currentTarget
          const raw = input.value
          const next = raw.replaceAll(',', '')
          const [whole, fraction] = next.split('.')
          const normalizedWhole = whole.replace(/^0+(?=\d)/, '')
          if (
            !/^\d*(?:\.\d*)?$/.test(next) ||
            normalizedWhole.length > maxIntegerDigits ||
            (fraction !== undefined &&
              (!maxFractionDigits || fraction.length > maxFractionDigits))
          ) {
            input.value = formatNumber(value)
            return
          }
          const normalized =
            fraction === undefined
              ? normalizedWhole
              : `${normalizedWhole || '0'}.${fraction}`
          const beforeCaret = raw
            .slice(0, input.selectionStart ?? raw.length)
            .replaceAll(',', '')
          const formatted = formatNumber(normalized)
          const removedZeros = whole.length - normalizedWhole.length
          const position = caretPosition(
            formatted,
            beforeCaret.length -
              removedZeros +
              (whole === '' && fraction !== undefined ? 1 : 0),
          )
          onValueChange(normalized)
          input.value = formatted
          input.setSelectionRange(position, position)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          const input = event.currentTarget
          const start = input.selectionStart
          if (start === null || start !== input.selectionEnd) return
          // Skip separators so deleting beside one still removes a digit.
          if (event.key === 'Backspace' && input.value[start - 1] === ',')
            input.setSelectionRange(start - 1, start - 1)
          if (event.key === 'Delete' && input.value[start] === ',')
            input.setSelectionRange(start + 1, start + 1)
        }}
      />
    </div>
  )
}
