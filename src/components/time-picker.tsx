import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { ChevronDown, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'

const hours = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0'),
)
const minutes = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0'),
)

export function TimePicker({
  id,
  value,
  onChange,
  onBlur,
  buttonRef,
  disabled,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  buttonRef?: Ref<HTMLButtonElement>
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('00:00')
  const [hour, minute] = draft.split(':')
  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        if (next) setDraft(value || '00:00')
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            ref={buttonRef}
            variant="outline"
            onBlur={onBlur}
            disabled={disabled}
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-value${describedBy ? ` ${describedBy}` : ''}`}
            aria-invalid={invalid}
            className="min-h-12 w-full justify-start text-left font-normal"
          />
        }
      >
        <Clock3 aria-hidden="true" className="text-muted-foreground" />
        <span id={`${id}-value`} className="flex-1 tabular-nums">
          {value || 'Select time'}
        </span>
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        initialFocus={() =>
          document
            .getElementById(`${id}-hours`)
            ?.querySelector<HTMLElement>('[aria-selected="true"]')
        }
        className="max-h-(--available-height) w-64 max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-0 motion-reduce:animate-none!"
      >
        <PopoverTitle className="sr-only">Choose time</PopoverTitle>
        <div className="grid grid-cols-2 divide-x">
          <TimeColumn
            id={`${id}-hours`}
            label="Hour"
            options={hours}
            value={hour}
            onChange={(next) => setDraft(`${next}:${minute}`)}
          />
          <TimeColumn
            id={`${id}-minutes`}
            label="Minute"
            options={minutes}
            value={minute}
            onChange={(next) => setDraft(`${hour}:${next}`)}
          />
        </div>
        <div className="flex justify-end border-t p-3">
          <Button
            className="min-h-11"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TimeColumn({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const selected = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selected.current?.scrollIntoView({ block: 'nearest' })
  }, [value])

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowDown')
      next = Math.min(index + 1, options.length - 1)
    else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else return
    event.preventDefault()
    onChange(options[next])
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role=option]')
      [next]?.focus()
  }

  return (
    <div className="min-w-0">
      <p
        id={`${id}-label`}
        className="px-3 pt-3 pb-2 text-center text-sm font-medium"
      >
        {label}
      </p>
      <div
        id={id}
        role="listbox"
        aria-labelledby={`${id}-label`}
        className="h-56 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={value === option}
            ref={value === option ? selected : undefined}
            tabIndex={value === option ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => handleKey(event, index)}
            className={`flex min-h-11 w-full items-center justify-center rounded-lg text-sm tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${value === option ? 'bg-accent font-semibold text-accent-foreground' : 'hover:bg-muted'}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
