import { dashboardKey } from '@/features/admin/dashboard/dashboard-queries'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { sessionGeneration } from '@/features/auth/auth-session'
import { unitsKey } from '@/features/admin/units/unit-queries'
import { closeReport } from '../report-api'
import { reportsKey, reportDetailKey } from '../report-queries'

export function useReportClosure(id: string) {
  const client = useQueryClient()
  const active = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => () => active.current?.abort(), [])
  const mutation = useMutation({
    mutationKey: [...reportsKey, 'close', id.toLowerCase()],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () =>
      Promise.all([
        client.cancelQueries({ queryKey: reportsKey }),
        client.cancelQueries({ queryKey: dashboardKey }),
      ]),
    mutationFn: ({
      signal,
      generation,
    }: {
      signal: AbortSignal
      generation: number
    }) => {
      if (signal.aborted || generation !== sessionGeneration(client))
        throw new CanceledError()
      return closeReport(id, signal)
    },
  })

  async function submit() {
    if (active.current) return
    const controller = new AbortController()
    const generation = sessionGeneration(client)
    const isCurrent = () =>
      !controller.signal.aborted && generation === sessionGeneration(client)
    active.current = controller
    setBusy(true)
    try {
      const report = await mutation.mutateAsync({
        signal: controller.signal,
        generation,
      })
      if (!isCurrent()) return
      client.setQueryData(reportDetailKey(id), report)
      await Promise.all([
        client.invalidateQueries({ queryKey: [...reportsKey, 'list'] }),
        client.invalidateQueries({ queryKey: unitsKey }),
        client.invalidateQueries({ queryKey: dashboardKey }),
      ])
      if (isCurrent()) return report
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return
      throw error
    } finally {
      active.current = null
      setBusy(false)
      mutation.reset()
    }
  }

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: reportsKey }),
      client.invalidateQueries({ queryKey: unitsKey }),
      client.invalidateQueries({ queryKey: dashboardKey }),
    ])
  }

  return { busy, submit, refresh }
}
