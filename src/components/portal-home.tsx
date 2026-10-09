import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { portals, type PortalId } from '@/layouts/portals'

export function PortalHome({ portal }: { portal: PortalId }) {
  const config = portals[portal]
  const Icon = config.icon

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight text-balance md:text-4xl">
          {config.heading}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          {config.description}
        </p>
      </div>
      <section
        aria-labelledby="empty-title"
        className="flex flex-col items-center rounded-xl border px-5 py-12 text-center md:py-16"
      >
        <Icon
          aria-hidden="true"
          className="mb-5 size-8 text-muted-foreground"
          strokeWidth={1.5}
        />
        <h2 id="empty-title" className="text-base font-semibold">
          {config.emptyTitle}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {config.emptyDescription}
        </p>
        <Button
          className="mt-6 min-h-11 px-4"
          nativeButton={false}
          role="link"
          render={<Link to={config.example} />}
        >
          Try example form <ArrowUpRight aria-hidden="true" />
        </Button>
      </section>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Starter preview · No live property data
      </p>
    </div>
  )
}

export function ResidentHome() {
  return <PortalHome portal="resident" />
}
export function AdminHome() {
  return <PortalHome portal="admin" />
}
export function TechnicianHome() {
  return <PortalHome portal="technician" />
}
