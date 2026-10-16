import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { sessionGeneration, sessionKey } from '@/features/auth/auth-session'
import type { Actor } from '@/features/auth/auth-schema'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { toast } from '@/components/ui/toast'
import {
  technicianTaskDetailQueryOptions,
  technicianTasksQueryOptions,
} from './technician-queries'
import {
  completeTask,
  saveWorkCosts,
  saveWorkResult,
  uploadReceipt,
  uploadRepairPhoto,
} from './completion-api'
import {
  completionFileError,
  completionReportSchema,
  type CompletionReport,
  type CompletionValues,
} from './completion-schema'

type Attempt = {
  values: CompletionValues
  photos: File[]
  receipt?: File
  controller: AbortController
  generation: number
  phase: 'result' | 'costs' | 'photo' | 'receipt' | 'complete'
  file?: File
}

export function useCompleteTask(actorId: string, reportId: string) {
  const client = useQueryClient()
  const active = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [receipt, setReceipt] = useState<File>()
  const [accessLost, setAccessLost] = useState(false)
  const [feedback, setFeedback] = useState('')
  const detail = useMemo(
    () => technicianTaskDetailQueryOptions(actorId, reportId),
    [actorId, reportId],
  )
  const tasksKey = useMemo(
    () => technicianTasksQueryOptions(actorId).queryKey,
    [actorId],
  )
  useEffect(() => {
    return () => {
      if (!active.current) return
      active.current.abort()
      // A cancelled response may still have saved on the server. Re-read on return.
      const actor = client.getQueryData<Actor | null>(sessionKey)
      if (actor?.id === actorId && actor.role === 'TECHNICIAN') {
        void client.invalidateQueries({
          queryKey: detail.queryKey,
          refetchType: 'none',
        })
        void client.invalidateQueries({
          queryKey: tasksKey,
          refetchType: 'none',
        })
      }
    }
  }, [client, actorId, detail.queryKey, tasksKey])

  function isCurrent(attempt: Attempt) {
    const actor = client.getQueryData<Actor | null>(sessionKey)
    return (
      !attempt.controller.signal.aborted &&
      attempt.generation === sessionGeneration(client) &&
      actor?.id === actorId &&
      actor.role === 'TECHNICIAN'
    )
  }
  function assertCurrent(attempt: Attempt) {
    if (!isCurrent(attempt)) throw new CanceledError()
  }
  function store(attempt: Attempt, report: CompletionReport) {
    assertCurrent(attempt)
    if (report.assignment?.technician?.id !== actorId)
      throw new ApiError(
        'This task is no longer assigned to you.',
        'FORBIDDEN',
        403,
      )
    client.setQueryData(detail.queryKey, report)
  }

  const mutation = useMutation({
    mutationKey: ['technician', 'complete', actorId, reportId],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () =>
      Promise.all([
        client.cancelQueries({ queryKey: detail.queryKey }),
        client.cancelQueries({ queryKey: tasksKey }),
      ]),
    mutationFn: async (attempt: Attempt) => {
      const signal = attempt.controller.signal
      assertCurrent(attempt)
      let saved = await saveWorkResult(reportId, attempt.values, signal)
      store(attempt, saved)
      attempt.phase = 'costs'
      saved = await saveWorkCosts(reportId, attempt.values, signal)
      store(attempt, saved)
      attempt.phase = 'photo'
      for (const file of attempt.photos) {
        assertCurrent(attempt)
        attempt.file = file
        const photo = await uploadRepairPhoto(reportId, file, signal)
        assertCurrent(attempt)
        if (saved.repairPhotos.some((existing) => existing.id === photo.id))
          throw new ApiError(
            'The photo upload could not be confirmed.',
            'INVALID_RESPONSE',
            200,
          )
        saved = { ...saved, repairPhotos: [...saved.repairPhotos, photo] }
        store(attempt, saved)
        setPhotos((pending) => pending.filter((selected) => selected !== file))
        attempt.file = undefined
      }
      if (attempt.receipt) {
        assertCurrent(attempt)
        attempt.phase = 'receipt'
        attempt.file = attempt.receipt
        const attachment = await uploadReceipt(
          reportId,
          attempt.receipt,
          signal,
        )
        saved = { ...saved, receipt: attachment }
        store(attempt, saved)
        setReceipt(undefined)
        attempt.file = undefined
      }
      assertCurrent(attempt)
      attempt.phase = 'complete'
      saved = await completeTask(reportId, signal)
      store(attempt, saved)
      return saved
    },
  })

  async function submit(report: CompletionReport, values: CompletionValues) {
    if (
      active.current ||
      report.status !== 'IN_PROGRESS' ||
      report.assignment?.technician?.id !== actorId
    )
      return
    const fileError = completionFileError(report, photos, receipt)
    if (fileError) throw new Error(fileError.message)
    const controller = new AbortController()
    const attempt: Attempt = {
      values,
      photos: [...photos],
      receipt,
      controller,
      generation: sessionGeneration(client),
      phase: 'result',
    }
    active.current = controller
    setBusy(true)
    setFeedback('')
    try {
      return await mutation.mutateAsync(attempt)
    } catch (error) {
      if (isCancel(error) || !isCurrent(attempt)) return
      const uncertain =
        !(error instanceof ApiError) ||
        !error.statusCode ||
        error.statusCode >= 500 ||
        error.code === 'INVALID_RESPONSE'
      let message = getErrorMessage(error)
      if (uncertain && attempt.file) {
        if (attempt.phase === 'photo')
          setPhotos((pending) =>
            pending.filter((file) => file !== attempt.file),
          )
        if (attempt.phase === 'receipt') setReceipt(undefined)
        message +=
          ' Check the saved attachments and reselect any missing file before submitting again.'
      }
      if (
        error instanceof ApiError &&
        [403, 404].includes(error.statusCode ?? 0)
      )
        setAccessLost(true)
      await client.invalidateQueries({
        queryKey: detail.queryKey,
        refetchType: 'none',
      })
      try {
        const refreshed = completionReportSchema.parse(
          await client.fetchQuery(detail),
        )
        assertCurrent(attempt)
        if (refreshed.assignment?.technician?.id !== actorId)
          setAccessLost(true)
        if (
          refreshed.assignment?.technician?.id === actorId &&
          attempt.phase === 'complete' &&
          ['COMPLETED', 'CLOSED'].includes(refreshed.status)
        )
          return refreshed
      } catch (readError) {
        if (isCancel(readError) || !isCurrent(attempt)) return
        message +=
          ' Saved information could not be refreshed. Retry the task read before submitting again.'
      }
      if (!isCurrent(attempt)) return
      setFeedback(message)
      toast.add({
        title: 'Unable to complete task',
        description: message,
        type: 'error',
      })
      throw error
    } finally {
      if (isCurrent(attempt)) {
        void client.invalidateQueries({ queryKey: tasksKey })
        void client.invalidateQueries({
          queryKey: detail.queryKey,
          refetchType: 'none',
        })
        setBusy(false)
        mutation.reset()
      }
      active.current = null
    }
  }
  return {
    busy,
    photos,
    setPhotos,
    receipt,
    setReceipt,
    accessLost,
    feedback,
    submit,
  }
}
