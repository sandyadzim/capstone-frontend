import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { toast } from '@/components/ui/toast'
import { sessionGeneration } from '@/features/auth/auth-session'
import { createAccount } from '../account-api'
import { accountsKey } from '../account-queries'
import type { AccountCreate } from '../account-schema'

export function useCreateAccount() {
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

  const mutation = useMutation({
    mutationKey: [...accountsKey, 'create'],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: accountsKey }),
    mutationFn: (values: AccountCreate) => {
      if (!isCurrent() || !active.current) throw new CanceledError()
      return createAccount(values, active.current.controller.signal)
    },
    onSuccess: async () => {
      if (!isCurrent()) return
      // Includes the Resident options used by Unit placement. Read failures
      // stay on their lists and must not turn a successful write into a failure.
      await client.invalidateQueries({ queryKey: accountsKey })
      if (isCurrent()) toast.add({ title: 'Account created', type: 'success' })
    },
  })

  async function create(values: AccountCreate) {
    if (active.current) return
    active.current = {
      controller: new AbortController(),
      generation: sessionGeneration(client),
    }
    try {
      const account = await mutation.mutateAsync(values)
      if (isCurrent()) return account
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return
      throw error
    } finally {
      active.current = null
      // Drop mutation variables (including the password) after each attempt.
      mutation.reset()
    }
  }

  return { create, busy: mutation.isPending }
}
