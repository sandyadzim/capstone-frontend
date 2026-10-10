import { getErrorMessage } from '@/lib/api/error'
import { Button } from '@/components/ui/button'
import { usePropertySettings } from '../hooks/use-property-settings'
import { PropertyDetailsForm } from '../components/property-details-form'
import { PropertyLogoForm } from '../components/property-logo-form'
import { SettingsLoading } from '../components/settings-loading'

export function SettingsPage() {
  const settings = usePropertySettings()
  const { query } = settings
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Manage the details and logo of your configured property.
      </p>
      {query.isPending ? (
        <SettingsLoading />
      ) : (
        <>
          {query.isError && (
            <section
              aria-label="Property settings error"
              className="mt-6 rounded-xl border p-6"
            >
              <p role="alert" className="text-sm leading-6 text-destructive">
                {getErrorMessage(query.error)}
              </p>
              <Button
                variant="outline"
                className="mt-4 min-h-11 px-4"
                disabled={query.isFetching || settings.busy}
                onClick={() => {
                  void query.refetch()
                }}
              >
                {query.isFetching ? 'Retrying…' : 'Try again'}
              </Button>
            </section>
          )}
          {query.data && (
            <div className="mt-6 space-y-5">
              <section
                aria-labelledby="property-details-title"
                className="rounded-xl border bg-card p-5"
              >
                <h2
                  id="property-details-title"
                  className="text-base font-semibold"
                >
                  Property details
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The name and address used for this property.
                </p>
                <PropertyDetailsForm
                  property={query.data}
                  busy={settings.busy}
                  saving={settings.saving}
                  onSave={settings.saveDetails}
                />
              </section>
              <section
                aria-labelledby="property-logo-title"
                className="rounded-xl border bg-card p-5"
              >
                <h2
                  id="property-logo-title"
                  className="text-base font-semibold"
                >
                  Property logo
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Upload, replace, or remove the property logo. Logo changes
                  save separately from property details.
                </p>
                <PropertyLogoForm
                  logoUrl={query.data.logoUrl}
                  busy={settings.busy}
                  uploading={settings.uploading}
                  removing={settings.removing}
                  onUpload={settings.uploadLogo}
                  onRemove={settings.removeLogo}
                />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
