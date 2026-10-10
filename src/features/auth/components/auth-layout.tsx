import type { ReactNode } from 'react'
import { Brand } from '@/components/brand'
import { ThemeMenu } from '@/components/theme-menu'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell flex min-h-svh flex-col bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Brand />
        <ThemeMenu />
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-8 outline-none"
      >
        {children}
      </main>
    </div>
  )
}
