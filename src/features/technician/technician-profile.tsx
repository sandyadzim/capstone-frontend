import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InformationLoading, ReadError } from '@/components/read-feedback'
import { sessionQueryOptions } from '@/features/auth/auth-session'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { useThemeStore } from '@/stores/theme-store'
import { technicianPropertyQueryOptions } from './technician-queries'

const appearanceOptions = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

export function TechnicianProfile() {
  const client = useQueryClient()
  const { data: actor } = useQuery(sessionQueryOptions(client))
  const property = useQuery({
    ...technicianPropertyQueryOptions(actor?.id ?? ''),
    enabled: actor?.role === 'TECHNICIAN',
  })
  const logout = useSignOut()
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  if (!actor) return null
  return (
    <div className="technician-profile">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background px-5 pt-[calc(.75rem+env(safe-area-inset-top))] pb-4">
        <Button
          nativeButton={false}
          role="link"
          variant="ghost"
          size="icon"
          className="size-11"
          render={<Link to="/technician" aria-label="Back to home" />}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Your profile</h1>
      </header>
      <div className="space-y-7 px-6 pb-6">
        <section aria-labelledby="technician-account-heading">
          <h2
            id="technician-account-heading"
            className="mb-4 text-base font-semibold"
          >
            Your account
          </h2>
          <dl className="profile-information">
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
          aria-labelledby="technician-property-heading"
          className="border-t pt-6"
        >
          <h2
            id="technician-property-heading"
            className="mb-4 text-base font-semibold"
          >
            Property
          </h2>
          {property.isPending ? (
            <InformationLoading label="property information" />
          ) : (
            property.data && (
              <dl className="profile-information">
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
          aria-labelledby="technician-appearance-heading"
          className="border-t pt-6"
        >
          <h2
            id="technician-appearance-heading"
            className="mb-4 text-base font-semibold"
          >
            Appearance
          </h2>
          <div
            role="group"
            aria-labelledby="technician-appearance-heading"
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
          >
            {appearanceOptions.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant="ghost"
                className={`min-h-11 px-2 text-xs ${theme === value ? 'bg-background shadow-sm hover:bg-background' : ''}`}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
        </section>
        <Button
          variant="secondary"
          className="min-h-11 w-full bg-muted text-destructive-text"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut aria-hidden="true" />
          {logout.isPending ? 'Loading…' : 'Sign out'}
        </Button>
      </div>
    </div>
  )
}
