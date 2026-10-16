import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/theme-store'
import { InformationLoading, ReadError } from '@/components/read-feedback'
import {
  residentPropertyQueryOptions,
  residentUnitQueryOptions,
} from './resident-queries'

const appearanceOptions = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

export function ResidentProfile() {
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
  const logout = useSignOut()
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  if (!actor) return null
  const placement = unit.data?.unit
  return (
    <div className="resident-profile">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background px-6 pt-[calc(.75rem+env(safe-area-inset-top))] pb-4">
        <Button
          nativeButton={false}
          role="link"
          variant="ghost"
          size="icon"
          className="size-11"
          render={<Link to="/" aria-label="Back to home" />}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Your profile</h1>
      </header>
      <div className="space-y-8 px-6 pb-8">
        <section aria-labelledby="resident-unit-heading">
          <h2 id="resident-unit-heading" className="sr-only">
            Your unit
          </h2>
          <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground">
            <Building2
              aria-hidden="true"
              className="mb-5 size-7 text-sidebar-primary"
            />
            {unit.isPending ? (
              <InformationLoading label="unit information" />
            ) : unit.data ? (
              placement ? (
                <dl>
                  <div>
                    <dt className="sr-only">Unit Name</dt>
                    <dd className="text-4xl leading-tight font-medium tracking-tight wrap-anywhere">
                      {placement.unitNumber}
                    </dd>
                  </div>
                  <div className="mt-2 flex gap-1 text-sm text-sidebar-muted-foreground">
                    <dt>Floor</dt>
                    <dd>{placement.floor}</dd>
                  </div>
                </dl>
              ) : (
                <div>
                  <p className="text-2xl leading-8 font-medium tracking-tight">
                    No unit assigned
                  </p>
                  <p className="mt-3 text-sm leading-6 text-sidebar-muted-foreground">
                    Your account hasn’t been assigned to a unit yet. Please
                    contact your property administrator.
                  </p>
                </div>
              )
            ) : (
              <p className="text-2xl leading-8 font-medium tracking-tight">
                Unit unavailable
              </p>
            )}
          </div>
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
        </section>

        <section aria-labelledby="resident-account-heading">
          <h2
            id="resident-account-heading"
            className="mb-4 text-base font-semibold tracking-tight"
          >
            Your account
          </h2>
          <dl className="resident-information">
            <div>
              <dt>Name</dt>
              <dd>{actor.name}</dd>
            </div>
            <div>
              <dt>Login ID</dt>
              <dd>{actor.loginIdentifier}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="resident-property-heading"
          className="border-t pt-6"
        >
          <h2
            id="resident-property-heading"
            className="mb-4 text-base font-semibold tracking-tight"
          >
            Property
          </h2>
          {property.isPending ? (
            <InformationLoading label="property information" />
          ) : (
            property.data && (
              <dl className="resident-information">
                <div>
                  <dt>Name</dt>
                  <dd>{property.data.name}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd className="whitespace-pre-line">
                    {property.data.address}
                  </dd>
                </div>
              </dl>
            )
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

        <section
          aria-labelledby="resident-appearance-heading"
          className="border-t pt-6"
        >
          <h2
            id="resident-appearance-heading"
            className="mb-4 text-base font-semibold tracking-tight"
          >
            Appearance
          </h2>
          <div
            role="group"
            aria-labelledby="resident-appearance-heading"
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
          >
            {appearanceOptions.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant="ghost"
                className={`min-h-11 text-xs ${theme === value ? 'bg-background shadow-sm hover:bg-background' : ''}`}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
        </section>
      </div>
      <div className="px-6 pb-6">
        <Button
          variant="secondary"
          className="min-h-11 w-full bg-muted text-destructive-text"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut aria-hidden="true" />
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </div>
  )
}
