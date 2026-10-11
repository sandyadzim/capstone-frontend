import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isCancel } from 'axios'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/error'
import { actorSchema, type Actor } from '@/features/auth/auth-schema'
import {
  clearRevokedSession,
  sessionGeneration,
  sessionKey,
} from '@/features/auth/auth-session'
import { unitsKey } from '../../units/unit-queries'
import { updateAccount, deactivateAccount } from '../account-api'
import { accountsKey, accountDetailKey } from '../account-queries'
import type { Account, AccountPatch } from '../account-schema'

export function useAccountMutations(id: string) {
  const client = useQueryClient()
  const active = useRef<{
    controller: AbortController
    generation: number
    own: boolean
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
    if (!isCurrent() || !active.current) throw new CanceledError()
    return active.current.controller.signal
  }

  async function cancelReads(membership = false) {
    await client.cancelQueries({ queryKey: accountsKey })
    if (membership) await client.cancelQueries({ queryKey: unitsKey })
  }

  async function refresh(membership = false) {
    await Promise.all([
      client.invalidateQueries({ queryKey: accountsKey }),
      ...(membership ? [client.invalidateQueries({ queryKey: unitsKey })] : []),
    ])
  }

  async function saved(account: Account, title: string, membership = false) {
    if (!isCurrent()) return
    client.setQueryData(accountDetailKey(id), account)
    await refresh(membership)
    if (isCurrent()) toast.add({ title, type: 'success' })
  }

  async function failed(error: Error, membership = false) {
    if (
      isCurrent() &&
      error instanceof ApiError &&
      [404, 409].includes(error.statusCode ?? 0)
    )
      await refresh(membership)
  }

  const updateMutation = useMutation({
    mutationKey: [...accountsKey, 'write', id],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: (values: AccountPatch) => cancelReads(values.role !== undefined),
    mutationFn: (values: AccountPatch) =>
      updateAccount(id, values, getSignal()),
    onSuccess: async (account, values) => {
      if (!isCurrent()) return
      // Identity edits must also update the signed-in administrator's header.
      if (active.current?.own) {
        client.setQueryData(accountDetailKey(id), account)
        client.setQueryData(sessionKey, actorSchema.parse(account))
        await client.invalidateQueries({ queryKey: sessionKey })
      }
      await saved(account, 'Account updated', values.role !== undefined)
    },
    onError: (error, values) => failed(error, values.role !== undefined),
  })

  const activateMutation = useMutation({
    mutationKey: [...accountsKey, 'write', id],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () => cancelReads(true),
    mutationFn: () => updateAccount(id, { isActive: true }, getSignal()),
    onSuccess: (account) => saved(account, 'Account activated', true),
    onError: (error) => failed(error, true),
  })

  const deactivateMutation = useMutation({
    mutationKey: [...accountsKey, 'write', id],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: () => cancelReads(true),
    mutationFn: () => deactivateAccount(id, getSignal()),
    onSuccess: (account) => saved(account, 'Account deactivated', true),
    onError: (error) => failed(error, true),
  })

  const passwordMutation = useMutation({
    mutationKey: [...accountsKey, 'write', id],
    meta: { requiresAuth: true },
    retry: false,
    gcTime: 0,
    onMutate: async () => {
      await cancelReads()
      if (active.current?.own)
        await client.cancelQueries({ queryKey: sessionKey })
    },
    mutationFn: (password: string) =>
      updateAccount(id, { password }, getSignal()),
    onSuccess: async (account) => {
      if (!isCurrent()) return
      if (active.current?.own) {
        toast.add({
          title: 'Password changed',
          description: 'Sign in again with your new password.',
          type: 'success',
        })
        await clearRevokedSession(client)
        return
      }
      await saved(account, 'Password changed')
    },
    onError: (error) => failed(error),
  })

  // All four mutations share one request lock and session/cancellation guard.
  async function run(write: () => Promise<Account>, reset: () => void) {
    if (active.current) return
    active.current = {
      controller: new AbortController(),
      generation: sessionGeneration(client),
      own:
        client.getQueryData<Actor>(sessionKey)?.id.toLowerCase() ===
        id.toLowerCase(),
    }
    try {
      const account = await write()
      if (isCurrent()) return account
    } catch (error) {
      if (isCancel(error) || !isCurrent()) return
      throw error
    } finally {
      active.current = null
      reset()
    }
  }

  return {
    busy:
      updateMutation.isPending ||
      activateMutation.isPending ||
      deactivateMutation.isPending ||
      passwordMutation.isPending,
    update: (values: AccountPatch) =>
      run(() => updateMutation.mutateAsync(values), updateMutation.reset),
    activate: () =>
      run(() => activateMutation.mutateAsync(), activateMutation.reset),
    deactivate: () =>
      run(() => deactivateMutation.mutateAsync(), deactivateMutation.reset),
    changePassword: (password: string) =>
      run(() => passwordMutation.mutateAsync(password), passwordMutation.reset),
  }
}
