import { HeadContent, Outlet } from '@tanstack/react-router'

export function Root() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  )
}
