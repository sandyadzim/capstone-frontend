import { Children, useId, useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function SearchFilter({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
  disabled = false,
  clearable = true,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  disabled?: boolean
  clearable?: boolean
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative min-w-0">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 pr-12 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 size-11"
            aria-label={`Clear ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
          >
            <X aria-hidden="true" className="absolute right-3 size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function SelectFilter({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  clearable = false,
}: {
  label: string
  placeholder: string
  value: string | null
  options: readonly { value: string; label: string; content?: ReactNode }[]
  onChange: (value: string | null) => void
  disabled?: boolean
  clearable?: boolean
}) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="min-w-0 space-y-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      <div className="relative min-w-0">
        <Select
          items={options}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
        >
          <SelectTrigger
            ref={triggerRef}
            id={id}
            aria-labelledby={`${id}-label`}
            hideIcon={clearable && value !== null}
            className={`min-h-11 w-full ${clearable && value !== null ? 'pr-12' : ''}`}
          >
            <SelectValue placeholder={placeholder}>
              {(selected: string | null) => {
                const option = options.find(
                  (option) => option.value === selected,
                )
                return option?.content ?? option?.label ?? placeholder
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem
                  className="min-h-11"
                  key={option.value}
                  value={option.value}
                >
                  {option.content ?? option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {clearable && value !== null && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 size-11"
            aria-label={`Clear ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => {
              onChange(null)
              triggerRef.current?.focus()
            }}
          >
            <X aria-hidden="true" className="absolute right-3 size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function ListFilters({
  search,
  children,
}: {
  search?: ReactNode
  children?: ReactNode
}) {
  const filters = Children.toArray(children)
  const rows = Array.from(
    { length: Math.ceil(filters.length / 3) },
    (_, index) => filters.slice(index * 3, index * 3 + 3),
  )
  return (
    <div
      role="group"
      aria-label="List filters"
      className="min-w-0 space-y-4 p-4"
    >
      {search}
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={index}
            className={`grid grid-cols-1 gap-4 ${row.length === 2 ? 'sm:grid-cols-2' : row.length === 3 ? 'sm:grid-cols-3' : ''}`}
          >
            {row.map((filter, index) => (
              <div key={index} className="min-w-0">
                {filter}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
