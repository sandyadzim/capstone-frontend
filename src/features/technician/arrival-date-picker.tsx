import { useState, type Ref } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'

export function ArrivalDatePicker({
  value,
  onChange,
  onBlur,
  buttonRef,
  disabled,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  buttonRef: Ref<HTMLButtonElement>
  disabled: boolean
  invalid: boolean
}) {
  const [open, setOpen] = useState(false)
  const date = value ? parseISO(value) : undefined
  const today = parseISO(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  )

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            ref={buttonRef}
            id="task-arrival-date"
            variant="outline"
            disabled={disabled}
            onBlur={onBlur}
            aria-labelledby="task-arrival-date-label"
            aria-describedby={
              invalid
                ? 'task-arrival-date-error task-arrival-date-value'
                : 'task-arrival-date-value'
            }
            aria-invalid={invalid}
            className="min-h-12 w-full justify-start text-left font-normal"
          />
        }
      >
        <CalendarIcon aria-hidden="true" />
        <span id="task-arrival-date-value" className="text-foreground">
          {date ? format(date, 'dd MMM yyyy') : 'Select date'}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-(--available-height) w-auto max-w-[calc(100vw-2rem)] overflow-y-auto p-0 motion-reduce:animate-none!"
      >
        <PopoverTitle className="sr-only">Choose arrival date</PopoverTitle>
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date ?? today}
          today={today}
          startMonth={today}
          disabled={{ before: today }}
          autoFocus
          className="[--cell-size:--spacing(11)]"
          onSelect={(selected) => {
            if (!selected) return
            onChange(format(selected, 'yyyy-MM-dd'))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
