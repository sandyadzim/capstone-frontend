import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { sessionGeneration } from '@/features/auth/auth-session'
import { unitsKey } from '@/features/admin/units/unit-queries'
import { verifyReport, rejectReport } from '../report-api'
import { reportsKey, reportDetailKey } from '../report-queries'
import type { ReportReject, ReportVerify } from '../report-schema'

type Review =
  | { decision: 'verify'; values: ReportVerify }
  | { decision: 'reject'; values: ReportReject }

export function useReportReview(id: string) {
  const client = useQueryClient()
  const active = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [decision, setDecision] = useState<Review['decision']>('verify')
  useEffect(() => () => active.current?.abort(), [])
  const mutation = useMutation({
    mutationKey: [...reportsKey, 'review', id.toLowerCase()],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: reportsKey }),
    mutationFn: ({
      review,
      signal,
      generation,
    }: {
      review: Review
      signal: AbortSignal
      generation: number
    }) => {
      if (signal.aborted || generation !== sessionGeneration(client))
        throw new CanceledError()
      return review.decision === 'verify'
        ? verifyReport(id, review.values, signal)
        : rejectReport(id, review.values, signal)
    },
  })

  async function submit(review: Review) {
    if (active.current) return
    const controller = new AbortController()
    const generation = sessionGeneration(client)
    const isCurrent = () =>
      !controller.signal.aborted && generation === sessionGeneration(client)
    active.current = controller
    setDecision(review.decision)
    setBusy(true)
    try {
      const report = await mutation.mutateAsync({
        review,
        signal: controller.signal,
        generation,
      })
      if (!isCurrent()) return
      client.setQueryData(reportDetailKey(id), report)
      await Promise.all([
        client.invalidateQueries({ queryKey: [...reportsKey, 'list'] }),
        client.invalidateQueries({ queryKey: unitsKey }),
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
    ])
  }

  return { busy, decision, submit, refresh }
}
