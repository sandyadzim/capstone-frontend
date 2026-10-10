import { Toaster } from '@/components/ui/toast'
import { HeadContent, Outlet } from '@tanstack/react-router'

export function Root() {
  return (
    <>
      <HeadContent />
      <Toaster />
      <Outlet />
    </>
  )
}
