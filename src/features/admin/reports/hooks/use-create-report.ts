import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isCancel } from 'axios'
import { sessionGeneration } from '@/features/auth/auth-session'
import { unitsKey } from '@/features/admin/units/unit-queries'
import { residentReportsKey } from '@/features/resident/resident-queries'
import { getErrorMessage } from '@/lib/api/error'
import { createReport, uploadDamagePhoto } from '../report-api'
import { reportsKey } from '../report-queries'
import type { CreatedReport, ReportCreate } from '../report-schema'

export function useCreateReport() {
  const client = useQueryClient()
  const [report, setReport] = useState<CreatedReport>()
  const [uploadError, setUploadError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const active = useRef<AbortController | null>(null)

  useEffect(() => () => active.current?.abort(), [])

  const createMutation = useMutation({
    mutationKey: [...reportsKey, 'create'],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    mutationFn: ({
      values,
      signal,
    }: {
      values: ReportCreate
      signal: AbortSignal
    }) => createReport(values, signal),
    onMutate: () =>
      Promise.all([
        client.cancelQueries({ queryKey: reportsKey }),
        client.cancelQueries({ queryKey: residentReportsKey }),
      ]),
  })
  const uploadMutation = useMutation({
    mutationKey: [...reportsKey, 'upload-damage-photo'],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    mutationFn: ({
      id,
      file,
      signal,
    }: {
      id: string
      file: File
      signal: AbortSignal
    }) => uploadDamagePhoto(id, file, signal),
  })

  async function create(values: ReportCreate, files: File[]) {
    if (active.current || report) return false
    const controller = new AbortController()
    const generation = sessionGeneration(client)
    const isCurrent = () =>
      !controller.signal.aborted && generation === sessionGeneration(client)
    active.current = controller
    setBusy(true)
    setUploadError(undefined)
    let created: CreatedReport | undefined
    try {
      setProgress('Creating report…')
      created = await createMutation.mutateAsync({
        values,
        signal: controller.signal,
      })
      if (!isCurrent()) return false
      setReport(created)
      await Promise.all([
        client.invalidateQueries({ queryKey: reportsKey }),
        client.invalidateQueries({ queryKey: residentReportsKey }),
        client.invalidateQueries({ queryKey: unitsKey }),
      ])
      for (const [index, file] of files.entries()) {
        if (!isCurrent()) return false
        setProgress(`Uploading photo ${index + 1} of ${files.length}…`)
        await uploadMutation.mutateAsync({
          id: created.id,
          file,
          signal: controller.signal,
        })
      }
      return isCurrent()
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return false
      if (!created) throw error
      setUploadError(
        `Report ${created.reportNumber} was created, but photo upload failed. ${getErrorMessage(error)}`,
      )
      return false
    } finally {
      active.current = null
      setBusy(false)
      setProgress('')
      createMutation.reset()
      uploadMutation.reset()
    }
  }

  return { report, uploadError, busy, progress, create }
}
