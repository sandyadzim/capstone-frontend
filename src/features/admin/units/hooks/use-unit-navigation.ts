import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { UnitsSearch } from '../unit-schema'

export function useUnitNavigation(
  from: '/admin/units/' | '/admin/units/$unitId/history' = '/admin/units/',
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
