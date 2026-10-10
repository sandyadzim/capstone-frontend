import { useEffect } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { PaginationMeta } from '@/lib/schemas/pagination'
import type { UnitsSearch } from '../unit-schema'

export function useUnitNavigation(
  from:
    | '/admin/units/'
    | '/admin/units/$unitId/resident'
    | '/admin/units/$unitId/history' = '/admin/units/',
) {
  const search = getRouteApi('/admin/units').useSearch()
  const navigate = useNavigate({ from })
  function changeSearch(patch: Partial<UnitsSearch>, replace = false) {
    void navigate({
      search: (previous) => ({ ...previous, ...patch }),
      replace,
    })
  }
  return { search, changeSearch, navigate }
}

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
