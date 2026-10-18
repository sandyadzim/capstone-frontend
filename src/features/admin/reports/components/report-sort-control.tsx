import { Button } from '@/components/ui/button'
import type { ReportSort } from '../report-schema'

export function ReportSortControl({
  value,
  onChange,
}: {
  value: ReportSort
  onChange: (value: ReportSort) => void
}) {
  return (
    <div
      role="group"
      aria-label="Report order"
      className="flex items-center gap-1 rounded-lg border bg-card p-1"
    >
      {(['latest', 'priority'] as const).map((sort) => (
        <Button
          key={sort}
          type="button"
          variant="ghost"
          className="min-h-11 px-4 aria-pressed:bg-accent aria-pressed:text-primary"
          aria-pressed={value === sort}
          onClick={() => onChange(sort)}
        >
          {sort === 'latest' ? 'Latest' : 'Priority'}
        </Button>
      ))}
    </div>
  )
}
