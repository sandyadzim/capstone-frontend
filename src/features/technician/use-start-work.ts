import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { ApiError } from '@/lib/api/error'
import { sessionGeneration, sessionKey } from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'
import { startTask } from './technician-task-api'
import type { StartWork } from './start-work-schema'
import {
  technicianTaskDetailQueryOptions,
  technicianTasksQueryOptions,
} from './technician-queries'

export function useStartWork(actorId: string, reportId: string) {
  const client = useQueryClient()
  const active = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => () => active.current?.abort(), [])
  const detailKey = technicianTaskDetailQueryOptions(actorId, reportId).queryKey
  const tasksKey = technicianTasksQueryOptions(actorId).queryKey
  const mutation = useMutation({
    mutationKey: ['technician', 'start', actorId, reportId],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () =>
      Promise.all([
        client.cancelQueries({ queryKey: detailKey }),
        client.cancelQueries({ queryKey: tasksKey }),
      ]),
    mutationFn: ({
      values,
      signal,
      generation,
    }: {
      values: StartWork
      signal: AbortSignal
      generation: number
    }) => {
      if (signal.aborted || generation !== sessionGeneration(client))
        throw new CanceledError()
      return startTask(reportId, values, signal)
    },
  })

  async function submit(values: StartWork) {
    if (active.current) return
    const controller = new AbortController()
    const generation = sessionGeneration(client)
    const isCurrent = () => {
      const actor = client.getQueryData<Actor | null>(sessionKey)
      return (
        !controller.signal.aborted &&
        generation === sessionGeneration(client) &&
        actor?.id === actorId &&
        actor.role === 'TECHNICIAN'
      )
    }
    active.current = controller
    setBusy(true)
    try {
      const report = await mutation.mutateAsync({
        values,
        signal: controller.signal,
        generation,
      })
      if (!isCurrent()) return
      if (report.assignment?.technician?.id !== actorId)
        throw new ApiError(
          'The server returned a different assignment.',
          'INVALID_RESPONSE',
          200,
        )
      client.setQueryData(detailKey, report)
      void client.invalidateQueries({ queryKey: tasksKey })
      return report
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return
      throw error
    } finally {
      active.current = null
      setBusy(false)
      mutation.reset()
    }
  }
  return { busy, submit }
}
