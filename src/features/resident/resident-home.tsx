import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ClipboardList } from 'lucide-react'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InformationLoading, ReadError } from './resident-information'
import {
  residentPropertyQueryOptions,
  residentUnitQueryOptions,
} from './resident-queries'

function PropertyBrand({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  const [imageFailed, setImageFailed] = useState(false)
  return (
    <Link
      to="/"
      title={name}
      aria-label={`${name} · Resident home`}
      className="flex min-h-11 min-w-0 max-w-60 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
    >
      {logoUrl && !imageFailed ? (
        <img
          src={logoUrl}
          alt={name}
          className="max-h-11 max-w-40 object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <Building2
            aria-hidden="true"
            className="size-6 shrink-0 text-sidebar-primary"
          />
          <span className="line-clamp-2 text-base leading-5 font-semibold tracking-tight wrap-anywhere">
            {name}
          </span>
        </>
      )}
    </Link>
  )
}

export function ResidentHome() {
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  const property = useQuery({
    ...residentPropertyQueryOptions,
    enabled: !!actor,
  })
  const unit = useQuery({
    ...residentUnitQueryOptions(actor?.id ?? ''),
    enabled: !!actor,
  })
  if (!actor) return null

  const placement = unit.data?.unit
  const initials = actor.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase()

  return (
    <div className="resident-home">
      <header className="bg-sidebar px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-8 text-sidebar-foreground">
        <div className="mb-8 flex items-center justify-between gap-4">
          {property.isPending ? (
            <Skeleton
              aria-hidden="true"
              className="h-8 w-40 bg-sidebar-accent"
            />
          ) : (
            <PropertyBrand
              key={property.data?.logoUrl}
              name={property.data?.name ?? 'Property'}
              logoUrl={property.data?.logoUrl ?? null}
            />
          )}
          <Button
            nativeButton={false}
            role="link"
            variant="ghost"
            size="icon"
            render={
              <Link
                to="/profile"
                aria-label={`Open profile for ${actor.name}`}
              />
            }
            className="size-11 shrink-0 rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-sidebar-ring"
          >
            {initials}
          </Button>
        </div>
        <h1 className="text-4xl leading-[1.14] font-medium tracking-tight wrap-anywhere">
          Welcome home,
          <span className="line-clamp-2">{actor.name}.</span>
        </h1>
        <div className="mt-3 text-sm leading-6 text-sidebar-muted-foreground">
          {unit.isPending ? (
            <Skeleton
              aria-hidden="true"
              className="h-5 w-40 bg-sidebar-accent"
            />
          ) : unit.data ? (
            placement ? (
              <p className="wrap-anywhere">
                Unit {placement.unitNumber} <span aria-hidden="true">·</span>{' '}
                Floor {placement.floor}
              </p>
            ) : (
              <p>No unit assigned</p>
            )
          ) : (
            <p>Unit information unavailable</p>
          )}
        </div>
      </header>

      <section
        aria-labelledby="resident-home-heading"
        className="px-6 pt-10 pb-8"
      >
        {unit.isPending ? (
          <>
            <h2
              id="resident-home-heading"
              className="mb-6 text-base font-semibold"
            >
              Your home
            </h2>
            <InformationLoading label="unit information" />
          </>
        ) : unit.data && !placement ? (
          <div className="mx-auto max-w-72 py-6 text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Building2 aria-hidden="true" className="size-7" />
            </div>
            <h2
              id="resident-home-heading"
              className="text-2xl leading-8 font-medium tracking-tight"
            >
              Let’s get you settled
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your account is ready. Contact your property administrator to get
              assigned to a unit.
            </p>
          </div>
        ) : placement ? (
          <>
            <h2
              id="resident-home-heading"
              className="text-base font-semibold tracking-tight"
            >
              Your ongoing reports
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Maintenance updates for your unit.
            </p>
            <div className="mx-auto max-w-64 py-12 text-center">
              <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground">
                <ClipboardList aria-hidden="true" className="size-7" />
              </div>
              <h3 className="text-base font-medium">No reports to show</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your maintenance requests and repair updates will appear here.
              </p>
            </div>
          </>
        ) : (
          <h2 id="resident-home-heading" className="text-base font-semibold">
            Your home
          </h2>
        )}
        {unit.isError && (
          <ReadError
            message={
              unit.data
                ? 'We couldn’t refresh your unit information.'
                : 'We couldn’t load your unit information.'
            }
            retry={() => {
              void unit.refetch()
            }}
            busy={unit.isFetching}
          />
        )}
        {property.isError && (
          <ReadError
            message={
              property.data
                ? 'We couldn’t refresh the property information.'
                : 'We couldn’t load the property information.'
            }
            retry={() => {
              void property.refetch()
            }}
            busy={property.isFetching}
          />
        )}
      </section>
    </div>
  )
}
