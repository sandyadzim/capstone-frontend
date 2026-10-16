import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReadError } from '@/components/read-feedback'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { technicianPropertyQueryOptions } from './technician-queries'
import { TechnicianTasks } from './technician-tasks'

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
      to="/technician"
      aria-label={`${name} · Technician home`}
      title={name}
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
          <span className="line-clamp-2 text-sm leading-5 font-semibold tracking-tight wrap-anywhere">
            {name}
          </span>
        </>
      )}
    </Link>
  )
}

export function TechnicianHome() {
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  const property = useQuery({
    ...technicianPropertyQueryOptions(actor?.id ?? ''),
    enabled: actor?.role === 'TECHNICIAN',
  })
  if (!actor) return null
  const initials = actor.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase()
  return (
    <div>
      <header className="bg-sidebar px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8 text-sidebar-foreground">
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
                to="/technician/profile"
                aria-label={`Open profile for ${actor.name}`}
              />
            }
            className="size-11 shrink-0 rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-sidebar-ring"
          >
            {initials}
          </Button>
        </div>
        <h1 className="text-4xl leading-[1.14] font-medium tracking-tight wrap-anywhere">
          Welcome back,
          <span className="block">{actor.name.trim().split(/\s+/)[0]}.</span>
        </h1>
        <p className="mt-3 text-sm leading-6 text-sidebar-muted-foreground">
          Here’s the work ahead.
        </p>
      </header>
      <section
        aria-labelledby="technician-tasks-heading"
        className="px-5 pt-6 pb-8"
      >
        <h2
          id="technician-tasks-heading"
          className="text-base font-semibold tracking-tight"
        >
          Your ongoing tasks
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Assigned work and updates, all in one place.
        </p>
        <TechnicianTasks key={actor.id} actorId={actor.id} />
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
