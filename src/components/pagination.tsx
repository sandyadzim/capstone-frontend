import {
  Pagination as PaginationNav,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  paginationPageSizes,
  type PaginationMeta,
} from '@/lib/schemas/pagination'

const sizeOptions = paginationPageSizes.map((size) => ({
  value: String(size),
  label: String(size),
}))

// Keep at most three page buttons so 44px targets fit narrow record cards.
function pageItems(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 3)
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (page <= 2) return [1, 2, 'ellipsis', totalPages]
  if (page >= totalPages - 1) return [1, 'ellipsis', totalPages - 1, totalPages]
  return [1, 'ellipsis', page, 'ellipsis', totalPages]
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  disabled?: boolean
}) {
  const { page, pageSize, total, totalPages } = meta
  return (
    <div className="@container flex flex-wrap items-center justify-end gap-x-4 gap-y-3 border-t p-4">
      <p
        role="status"
        className="text-sm whitespace-nowrap text-muted-foreground"
      >
        Total {total.toLocaleString()}
      </p>
      <Select
        items={sizeOptions}
        value={String(pageSize)}
        disabled={disabled}
        onValueChange={(value) => {
          if (value !== null) onPageSizeChange(Number(value))
        }}
      >
        <SelectTrigger aria-label="Page size" className="min-h-11 w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {sizeOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="min-h-11"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <PaginationNav aria-label="Pagination" className="mx-0 w-auto max-w-full">
        <PaginationContent className="flex-nowrap justify-end gap-0 @min-[20rem]:gap-0.5">
          <PaginationItem>
            <PaginationPrevious
              text=""
              aria-label="Previous"
              size="icon"
              className="size-11 p-0!"
              nativeButton
              render={<button type="button" />}
              disabled={disabled || page <= 1 || totalPages === 0}
              onClick={() => onPageChange(page - 1)}
            />
          </PaginationItem>
          {pageItems(page, totalPages).map((item, index) => (
            <PaginationItem
              key={item === 'ellipsis' ? `ellipsis-${index}` : item}
            >
              {item === 'ellipsis' ? (
                <PaginationEllipsis className="w-4" />
              ) : (
                <PaginationLink
                  aria-label={`Go to page ${item}`}
                  isActive={item === page}
                  className="min-h-11 min-w-11 px-2"
                  nativeButton
                  render={<button type="button" />}
                  disabled={disabled}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              text=""
              aria-label="Next"
              size="icon"
              className="size-11 p-0!"
              nativeButton
              render={<button type="button" />}
              disabled={disabled || page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationNav>
    </div>
  )
}
