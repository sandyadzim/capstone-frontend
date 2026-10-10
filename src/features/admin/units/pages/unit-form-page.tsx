import { useParams } from '@tanstack/react-router'
import { z } from 'zod'
import { UnitForm } from '../components/unit-form'
import {
  UnitPage,
  UnitBreadcrumbs,
  UnitReadState,
  UnitUnavailable,
} from '../components/unit-page'
import { useUnitMutations } from '../hooks/use-unit-mutations'
import { useUnitNavigation } from '../hooks/use-unit-navigation'
import { useUnit } from '../unit-queries'
import { changedUnitFields } from '../unit-utils'

export function NewUnitPage() {
  const { search, navigate } = useUnitNavigation()
  const mutations = useUnitMutations('')

  return (
    <UnitPage
      title="Create Unit"
      description="Add a unit to your property."
      search={search}
      breadcrumbs={<UnitBreadcrumbs current="Create Unit" search={search} />}
    >
      <UnitForm
        busy={mutations.busy}
        onSave={async (values) => {
          const unit = await mutations.create(values)
          if (unit)
            await navigate({
              to: '/admin/units/$unitId',
              params: { unitId: unit.id },
              search: { ...search, isArchived: false, page: 1 },
            })
        }}
      />
    </UnitPage>
  )
}
export function EditUnitPage() {
  const { unitId } = useParams({ from: '/admin/units/$unitId/edit' })
  const { search, navigate } = useUnitNavigation()
  const query = useUnit(unitId)
  const mutations = useUnitMutations(unitId)

  if (!z.uuid().safeParse(unitId).success)
    return <UnitUnavailable title="Invalid unit ID" search={search} />

  if (query.data?.isArchived)
    return <UnitUnavailable title="Archived unit" search={search} />

  return (
    <UnitPage
      title="Edit Unit"
      description="Update the unit number, floor, or maintenance flag."
      search={search}
      breadcrumbs={<UnitBreadcrumbs current="Edit Unit" search={search} />}
    >
      {(query.isPending || query.error) && (
        <UnitReadState
          variant="form"
          loading={query.isPending}
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      )}
      {query.data && (
        <UnitForm
          key={query.data.id}
          unit={query.data}
          busy={mutations.busy}
          onSave={async (values) => {
            const unit = await mutations.update(
              changedUnitFields(query.data, values),
            )
            if (unit)
              await navigate({
                to: '/admin/units/$unitId',
                params: { unitId },
                search,
              })
          }}
        />
      )}
    </UnitPage>
  )
}
