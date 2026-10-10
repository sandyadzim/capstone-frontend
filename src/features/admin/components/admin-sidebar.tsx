import { useState } from 'react'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Brand } from '@/components/brand'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminNav } from './admin-nav'
import {
  propertyQueryKey,
  propertyQueryOptions,
} from '../settings/hooks/use-property-settings'

function SidebarBrand({
  logoUrl,
  name,
  collapsed,
  loading,
  onNavigate,
}: {
  logoUrl: string | null
  name: string
  collapsed: boolean
  loading: boolean
  onNavigate?: () => void
}) {
  const [failed, setFailed] = useState(false)
  const hasLogo = !!logoUrl && !failed
  return (
    <div
      data-has-logo={hasLogo}
      className={`admin-brand flex shrink-0 items-center border-b border-sidebar-border ${hasLogo || collapsed ? 'justify-center' : 'justify-start'} ${collapsed ? 'px-3' : onNavigate && !hasLogo ? 'pr-16 pl-5' : 'px-5'}`}
    >
      {loading ? (
        <Skeleton
          className={`${collapsed ? 'size-8' : 'h-8 w-36'} bg-sidebar-accent`}
        />
      ) : (
        <Link
          to="/admin"
          activeOptions={{ exact: true }}
          aria-label="Admin home"
          aria-description={name}
          title={name}
          onClick={onNavigate}
          className={`flex min-h-11 w-full min-w-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring ${hasLogo ? 'justify-center' : collapsed ? 'justify-start pl-2' : 'justify-start'}`}
        >
          {hasLogo ? (
            <img
              src={logoUrl}
              alt="Property logo"
              className={`${collapsed ? 'size-10' : 'h-16 w-full max-w-40'} object-contain`}
              onError={() => setFailed(true)}
            />
          ) : (
            <Brand compact={collapsed} name={name} />
          )}
        </Link>
      )}
    </div>
  )
}

export function AdminSidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const busy = useIsMutating({ mutationKey: propertyQueryKey }) > 0
  const { data, isPending } = useQuery({
    ...propertyQueryOptions,
    enabled: !busy,
  })
  const logoUrl = data?.logoUrl ?? null
  return (
    <div className="flex h-full min-h-0 flex-col pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <SidebarBrand
        key={logoUrl}
        logoUrl={logoUrl}
        name={data?.name ?? 'Property'}
        collapsed={collapsed}
        loading={isPending}
        onNavigate={onNavigate}
      />
      <div
        className={`min-h-0 flex-1 overflow-y-auto py-4 ${collapsed ? 'px-3' : 'px-4'}`}
      >
        <AdminNav collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
