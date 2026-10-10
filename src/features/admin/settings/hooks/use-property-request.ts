import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { sessionGeneration } from '@/features/auth/auth-session'
import type { Property } from '../settings-schema'

export function usePropertyRequest() {
  const client = useQueryClient()
  const active = useRef<{
    controller: AbortController
    generation: number
  } | null>(null)

  useEffect(() => () => active.current?.controller.abort(), [])

  function isCurrent() {
    const request = active.current
    return (
      request !== null &&
      !request.controller.signal.aborted &&
      request.generation === sessionGeneration(client)
    )
  }

  function getSignal() {
    if (!active.current || !isCurrent()) throw new CanceledError()
    return active.current.controller.signal
  }

  async function run(mutation: () => Promise<Property>) {
    if (active.current) return
    active.current = {
      controller: new AbortController(),
      generation: sessionGeneration(client),
    }
    try {
      const property = await mutation()
      if (isCurrent()) return property
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return
      throw error
    } finally {
      active.current = null
    }
  }

  return { run, getSignal, isCurrent }
}
