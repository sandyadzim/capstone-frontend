import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware'
import { z } from 'zod'

export const themeSchema = z.enum(['system', 'light', 'dark'])
export type ThemePreference = z.infer<typeof themeSchema>

interface ThemeState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

// Appearance remains usable when a browser blocks local storage.
const storage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      // The in-memory preference still works for this session.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // Storage can be unavailable in restricted browsing contexts.
    }
  },
}

export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), {
    name: 'property-appearance',
    storage: createJSONStorage(() => storage),
    partialize: ({ theme }) => ({ theme }),
    merge: (persisted, current) => {
      const result = z.object({ theme: themeSchema }).safeParse(persisted)
      return result.success ? { ...current, theme: result.data.theme } : current
    },
  }),
)
