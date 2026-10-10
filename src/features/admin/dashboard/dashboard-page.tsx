import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function DashboardPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <Badge variant="secondary">Demo data</Badge>
      </div>
      <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
        An overview of your property and maintenance activity. These sample
        figures demonstrate the dashboard.
      </p>
      <dl className="mt-6 grid grid-cols-1 overflow-hidden rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Total units', '18'],
          ['Total reports', '42'],
          ['Active reports', '7'],
          ['In progress', '3'],
          ['Closed this month', '5'],
          ['Total closed cost', 'Rp 12,500,000.50'],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-b p-5 last:border-b-0 sm:nth-last-[-n+2]:border-b-0 lg:nth-last-[-n+3]:border-b-0"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-3 text-2xl font-semibold tracking-tight tabular-nums wrap-anywhere">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border bg-accent/50 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold">Property configuration</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Update your property details and logo in Settings.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 px-4"
          nativeButton={false}
          role="link"
          render={<Link to="/admin/settings" />}
        >
          Open Settings <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    </div>
  )
}
