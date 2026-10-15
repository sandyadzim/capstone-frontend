import { createContext, useContext } from 'react'

export const ResidentReportContext = createContext<{
  canReport: boolean
  hasUnit: boolean
  openReport: (trigger: HTMLButtonElement) => void
} | null>(null)

export function useResidentReport() {
  const context = useContext(ResidentReportContext)
  if (!context)
    throw new Error('Resident report controls require the resident layout.')
  return context
}
