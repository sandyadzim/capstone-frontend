import { useId, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'

export function DateRangeFilter({
  label,
  dateFrom,
  dateTo,
  onChange,
  error,
}: {
  label: string
  dateFrom?: string
  dateTo?: string
  onChange: (range: { dateFrom?: string; dateTo?: string }) => void
  error?: string
}) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>()
  const from = dateFrom ? parseISO(dateFrom) : undefined
  const to = dateTo ? parseISO(dateTo) : undefined
  const today = parseISO(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  )
  const summary =
    from && to
      ? `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`
      : from
        ? `From ${format(from, 'dd MMM yyyy')}`
        : to
          ? `Until ${format(to, 'dd MMM yyyy')}`
          : 'Select date range'

  return (
    <div className="min-w-0 space-y-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      <div className="relative min-w-0">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setDraft(error ? undefined : { from, to })
            setOpen(next)
          }}
        >
          <PopoverTrigger
            render={
              <Button
                ref={triggerRef}
                id={id}
                variant="outline"
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-value${error ? ` ${id}-error` : ''}`}
                aria-invalid={!!error}
                className="min-h-11 w-full justify-start pr-12 text-left font-normal"
              />
            }
          >
            <CalendarIcon aria-hidden="true" />
            <span
              id={`${id}-value`}
              className={`truncate ${from || to ? '' : 'text-muted-foreground'}`}
            >
              {summary}
            </span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-(--available-height) w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 motion-reduce:animate-none!"
          >
            <PopoverTitle className="sr-only">
              Select {label.toLowerCase()} range
            </PopoverTitle>
            <div className="min-h-0 overflow-y-auto">
              <Calendar
                mode="range"
                selected={draft}
                onSelect={setDraft}
                defaultMonth={from ?? to ?? today}
                today={today}
                autoFocus
                className="[--cell-size:--spacing(11)]"
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t p-3">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="min-h-11"
                disabled={!draft?.from || !draft.to}
                onClick={() => {
                  if (!draft?.from || !draft.to) return
                  onChange({
                    dateFrom: format(draft.from, 'yyyy-MM-dd'),
                    dateTo: format(draft.to, 'yyyy-MM-dd'),
                  })
                  setOpen(false)
                }}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 size-11"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              onChange({ dateFrom: undefined, dateTo: undefined })
              triggerRef.current?.focus()
            }}
          >
            <X aria-hidden="true" className="absolute right-3 size-4" />
          </Button>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm text-destructive-text"
        >
          {error}
        </p>
      )}
    </div>
  )
}
