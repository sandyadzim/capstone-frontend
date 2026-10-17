import { dashboardKey } from '@/features/admin/dashboard/dashboard-queries'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/error'
import {
  archiveUnit,
  createUnit,
  placeResident,
  releaseResident,
  updateUnit,
} from '../unit-api'
import { unitDetailKey, unitsKey } from '../unit-queries'
import type { Unit, UnitCreate, UnitPatch } from '../unit-schema'
import { useUnitRequest } from './use-unit-request'

export function useUnitMutations(id: string) {
  const client = useQueryClient()
  const request = useUnitRequest()

  async function cancelReads() {
    await client.cancelQueries({ queryKey: unitsKey })
    await client.cancelQueries({ queryKey: ['admin', 'accounts'] })
    await client.cancelQueries({ queryKey: dashboardKey })
  }

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: unitsKey }),
      client.invalidateQueries({ queryKey: dashboardKey }),
      client.invalidateQueries({ queryKey: ['admin', 'accounts'] }),
    ])
  }

  async function saved(unit: Unit, title: string) {
    if (!request.isCurrent()) return
    client.setQueryData(unitDetailKey(unit.id), unit)
    // A placement can change a second unit. Refresh all cached Unit views.
    await refresh()
    if (request.isCurrent()) toast.add({ title, type: 'success' })
  }

  async function failed(error: Error) {
    if (
      request.isCurrent() &&
      error instanceof ApiError &&
      [404, 409].includes(error.statusCode ?? 0)
    )
      await refresh()
  }

  const createMutation = useMutation({
    mutationKey: unitsKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: cancelReads,
    mutationFn: (values: UnitCreate) => createUnit(values, request.getSignal()),
    onSuccess: (unit) => saved(unit, 'Unit created'),
    onError: failed,
  })

  const updateMutation = useMutation({
    mutationKey: unitsKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: cancelReads,
    mutationFn: (values: UnitPatch) =>
      updateUnit(id, values, request.getSignal()),
    onSuccess: (unit) => saved(unit, 'Unit updated'),
    onError: failed,
  })

  const placeMutation = useMutation({
    mutationKey: unitsKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: cancelReads,
    mutationFn: (residentUserId: string) =>
      placeResident(id, residentUserId, request.getSignal()),
    onSuccess: (unit) => saved(unit, 'Resident placed'),
    onError: failed,
  })

  const releaseMutation = useMutation({
    mutationKey: unitsKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: cancelReads,
    mutationFn: () => releaseResident(id, request.getSignal()),
    onSuccess: (unit) => saved(unit, 'Resident released'),
    onError: failed,
  })

  const archiveMutation = useMutation({
    mutationKey: unitsKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: cancelReads,
    mutationFn: () => archiveUnit(id, request.getSignal()),
    onSuccess: (unit) => saved(unit, 'Unit archived'),
    onError: failed,
  })

  return {
    busy:
      createMutation.isPending ||
      updateMutation.isPending ||
      placeMutation.isPending ||
      releaseMutation.isPending ||
      archiveMutation.isPending,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    placing: placeMutation.isPending,
    releasing: releaseMutation.isPending,
    archiving: archiveMutation.isPending,
    create: (values: UnitCreate) =>
      request.run(() => createMutation.mutateAsync(values)),
    update: (values: UnitPatch) =>
      request.run(() => updateMutation.mutateAsync(values)),
    place: (residentUserId: string) =>
      request.run(() => placeMutation.mutateAsync(residentUserId)),
    release: () => request.run(() => releaseMutation.mutateAsync()),
    archive: () => request.run(() => archiveMutation.mutateAsync()),
  }
}
