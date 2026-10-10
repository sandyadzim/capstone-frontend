import { useEffect } from 'react'
import type { PaginationMeta } from '@/lib/schemas/pagination'

export function usePageCorrection(
  meta: PaginationMeta | undefined,
  page: number,
  onChange: (page: number) => void,
) {
  useEffect(() => {
    if (meta?.page === page && page > Math.max(1, meta.totalPages))
      onChange(Math.max(1, meta.totalPages))
  }, [meta, page, onChange])
}
