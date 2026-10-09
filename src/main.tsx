import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from '@/app/query-client'
import { router } from '@/app/router'
import { initializeTheme } from '@/app/theme'
import '@/lib/env'
import './index.css'

const cleanupTheme = initializeTheme()
if (import.meta.hot) import.meta.hot.dispose(cleanupTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
