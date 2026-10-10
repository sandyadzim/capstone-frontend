import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export type DataColumn<T> = {
  id: string
  header: string
  width?: number
  sticky?: 'right'
  cell: (row: T) => ReactNode
}

export function DataTable<T>({
  label,
  rows,
  columns,
  rowId,
  loading = false,
  updating = false,
  error,
  onRetry,
  emptyMessage = 'No results.',
  mobileRecord,
  tableMinWidth,
}: {
  label: string
  rows: T[]
  columns: DataColumn<T>[]
  rowId: (row: T) => string
  loading?: boolean
  updating?: boolean
  error?: string
  onRetry?: () => void
  emptyMessage?: string
  mobileRecord?: (row: T) => ReactNode
  tableMinWidth?: number
}) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [scrollable, setScrollable] = useState(false)
  useEffect(() => {
    const area = scrollAreaRef.current
    const table = tableRef.current
    if (!area || !table || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      setScrollable(area.scrollWidth > area.clientWidth)
    })
    observer.observe(area)
    observer.observe(table)
    return () => observer.disconnect()
  }, [loading, rows.length])
  const minimumWidth = Math.max(
    tableMinWidth ?? 0,
    columns.reduce(
      (total, column) =>
        total +
        (column.sticky
          ? (column.width ?? 0)
          : Math.max(150, column.width ?? 150)),
      0,
    ),
  )
  return (
    <section
      aria-label={label}
      aria-busy={loading || updating}
      className="@container px-4"
    >
      {error && (
        <div className="flex flex-wrap items-center gap-3 p-4">
          <p role="alert" className="flex-1 text-sm text-destructive-text">
            {error}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              className="min-h-11 px-4"
              disabled={updating}
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      )}
      {loading ? (
        <div className="space-y-3 p-5">
          <p role="status" className="sr-only">
            Loading {label.toLowerCase()}…
          </p>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        !error && (
          <p
            role="status"
            className="p-8 text-center text-sm text-muted-foreground"
          >
            {emptyMessage}
          </p>
        )
      ) : (
        <>
          {updating && (
            <p role="status" className="sr-only">
              Updating {label.toLowerCase()}…
            </p>
          )}
          <div
            ref={scrollAreaRef}
            className="hidden overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring @min-[48rem]:block"
            tabIndex={0}
            role="region"
            aria-label={`${label} scroll area`}
          >
            <table
              ref={tableRef}
              className="w-full border-separate border-spacing-0 text-left text-sm"
              style={{ minWidth: minimumWidth }}
            >
              <caption className="sr-only">{label}</caption>
              <thead className="bg-muted/50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      style={{
                        minWidth: column.sticky ? undefined : 150,
                        width: column.sticky
                          ? (column.width ?? 1)
                          : column.width
                            ? Math.max(150, column.width)
                            : undefined,
                      }}
                      className={`px-4 py-3 text-left font-medium whitespace-nowrap ${column.sticky === 'right' ? `sticky right-0 z-20 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] ${scrollable ? 'border-l' : ''}` : ''}`}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowId(row)} className="group even:bg-muted/20">
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        style={{
                          minWidth: column.sticky ? undefined : 150,
                          width: column.sticky
                            ? (column.width ?? 1)
                            : column.width
                              ? Math.max(150, column.width)
                              : undefined,
                        }}
                        className={`px-4 py-3 align-middle whitespace-nowrap ${column.sticky === 'right' ? `sticky right-0 z-10 bg-card group-even:bg-[color-mix(in_oklab,var(--muted)_20%,var(--card))] ${scrollable ? 'border-l' : ''}` : ''}`}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-label={`${label} records`} className="@min-[48rem]:hidden">
            {rows.map((row) => (
              <li
                key={rowId(row)}
                className="p-4 even:bg-muted/20 wrap-anywhere"
              >
                {mobileRecord ? (
                  mobileRecord(row)
                ) : (
                  <dl className="space-y-3">
                    {columns.map((column) => (
                      <div key={column.id}>
                        <dt className="text-xs font-medium text-muted-foreground">
                          {column.header}
                        </dt>
                        <dd className="mt-1 text-sm">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
