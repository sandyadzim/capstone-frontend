import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DataTable, type DataColumn } from '@/components/data-table'
import { SearchFilter } from '@/components/list-filters'
import { Pagination } from '@/components/pagination'
import { usePageCorrection } from '@/hooks/use-page-correction'
import { unitsQueryOptions } from '@/features/admin/units/unit-queries'
import type { Unit } from '@/features/admin/units/unit-schema'
import { getErrorMessage } from '@/lib/api/error'

export function ReportUnitPicker({
  unit,
  disabled,
  invalid,
  describedBy,
  inputRef,
  onBlur,
  onSelect,
}: {
  unit: Pick<Unit, 'id' | 'unitNumber' | 'floor'> | null
  disabled: boolean
  invalid: boolean
  describedBy?: string
  inputRef: React.Ref<HTMLButtonElement>
  onBlur: () => void
  onSelect: (unit: Unit) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const query = useQuery({
    ...unitsQueryOptions({
      q: q.trim() || undefined,
      page,
      pageSize,
      isArchived: 'false',
    }),
    enabled: open,
  })
  usePageCorrection(query.data?.meta, page, setPage)
  const columns: DataColumn<Unit>[] = [
    {
      id: 'name',
      header: 'Unit Name',
      cell: (unit) => (
        <span className="whitespace-normal wrap-anywhere">
          {unit.unitNumber}
        </span>
      ),
    },
    { id: 'floor', header: 'Floor', cell: (unit) => unit.floor },
    {
      id: 'select',
      header: 'Actions',
      sticky: 'right',
      cell: (unit) => (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-4 text-primary"
          aria-label={`Select unit ${unit.unitNumber}`}
          onClick={() => {
            onSelect(unit)
            setOpen(false)
          }}
        >
          Select
        </Button>
      ),
    },
  ]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className="flex min-h-11 items-center gap-3 rounded-lg border border-input bg-background py-2 pr-2 pl-3 data-invalid:border-destructive"
        data-invalid={invalid || undefined}
      >
        <span
          className={`min-w-0 flex-1 text-sm wrap-anywhere${unit ? '' : ' text-muted-foreground'}`}
        >
          {unit?.unitNumber ?? 'No unit selected'}
        </span>
        <DialogTrigger
          ref={inputRef}
          render={
            <Button
              type="button"
              variant="ghost"
              id="report-unit"
              disabled={disabled}
              onBlur={onBlur}
              aria-label={unit ? 'Change unit' : 'Select unit'}
              aria-required="true"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="min-h-11 px-4 text-primary hover:text-primary"
            />
          }
        >
          {unit ? 'Change' : 'Select'}
        </DialogTrigger>
      </div>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-4xl motion-reduce:animate-none!">
        <DialogHeader className="pr-12">
          <DialogTitle>Select unit</DialogTitle>
          <DialogDescription>
            Choose a non-archived unit for this report.
          </DialogDescription>
        </DialogHeader>
        <SearchFilter
          label="Search units"
          placeholder="Search unit name"
          maxLength={40}
          value={q}
          onChange={(value) => {
            setQ(value)
            setPage(1)
          }}
        />
        <DataTable
          label="Available units"
          columns={columns}
          rows={query.error ? [] : (query.data?.data ?? [])}
          rowId={(unit) => unit.id}
          loading={query.isPending}
          updating={query.isFetching && !query.isPending}
          error={query.error ? getErrorMessage(query.error) : undefined}
          onRetry={() => {
            void query.refetch()
          }}
          emptyMessage={
            q
              ? 'No units match your search.'
              : 'No non-archived units are available. Create a unit first.'
          }
        />
        {query.data && !query.error && (
          <Pagination
            meta={query.data.meta}
            disabled={query.isFetching}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
