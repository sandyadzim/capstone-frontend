import { create } from 'zustand'

export const useAdminUiStore = create<{
  collapsed: boolean
  toggleSidebar: () => void
}>((set) => ({
  collapsed: false,
  toggleSidebar: () => set((state) => ({ collapsed: !state.collapsed })),
}))
