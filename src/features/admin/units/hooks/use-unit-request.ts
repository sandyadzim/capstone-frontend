import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { sessionGeneration } from '@/features/auth/auth-session'
import type { Unit } from '../unit-schema'

// Keep one write per mounted page, and ignore completions from an old session.
export function useUnitRequest() {
  const client = useQueryClient()
  const active = useRef<{
    controller: AbortController
    generation: number
  } | null>(null)

  useEffect(() => () => active.current?.controller.abort(), [])

  function isCurrent() {
    return (
      active.current !== null &&
      !active.current.controller.signal.aborted &&
      active.current.generation === sessionGeneration(client)
    )
  }

  function getSignal() {
    if (!active.current || !isCurrent()) throw new CanceledError()
    return active.current.controller.signal
  }

  async function run(write: () => Promise<Unit>) {
    if (active.current) return
    active.current = {
      controller: new AbortController(),
      generation: sessionGeneration(client),
    }
    try {
      const unit = await write()
      if (isCurrent()) return unit
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return
      throw error
    } finally {
      active.current = null
    }
  }
  return { run, getSignal, isCurrent }
}
