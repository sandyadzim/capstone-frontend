import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import {
  getProperty,
  updateProperty,
  uploadPropertyLogo,
} from '../settings-api'
import type { PropertyPatch } from '../settings-schema'
import { usePropertyRequest } from './use-property-request'

export const propertyQueryKey = ['admin', 'property'] as const
export const propertyQueryOptions = queryOptions({
  queryKey: propertyQueryKey,
  queryFn: ({ signal }) => getProperty(signal),
  meta: { requiresAuth: true },
  staleTime: 60_000,
  retry: false,
})

export function usePropertySettings() {
  const client = useQueryClient()
  const request = usePropertyRequest()

  const saveDetailsMutation = useMutation({
    mutationKey: propertyQueryKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: propertyQueryKey }),
    mutationFn: (values: PropertyPatch) =>
      updateProperty(values, request.getSignal()),
    onSuccess: (property) => {
      if (!request.isCurrent()) return
      client.setQueryData(propertyQueryKey, property)
      toast.add({ title: 'Property details saved', type: 'success' })
    },
  })

  const uploadLogoMutation = useMutation({
    mutationKey: propertyQueryKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: propertyQueryKey }),
    mutationFn: (file: File) => uploadPropertyLogo(file, request.getSignal()),
    onSuccess: (property) => {
      if (!request.isCurrent()) return
      client.setQueryData(propertyQueryKey, property)
      toast.add({ title: 'Property logo saved', type: 'success' })
    },
  })

  const removeLogoMutation = useMutation({
    mutationKey: propertyQueryKey,
    meta: { requiresAuth: true },
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: propertyQueryKey }),
    mutationFn: () => updateProperty({ logoUrl: null }, request.getSignal()),
    onSuccess: (property) => {
      if (!request.isCurrent()) return
      client.setQueryData(propertyQueryKey, property)
      toast.add({ title: 'Property logo removed', type: 'success' })
    },
  })

  const busy =
    saveDetailsMutation.isPending ||
    uploadLogoMutation.isPending ||
    removeLogoMutation.isPending
  const query = useQuery({ ...propertyQueryOptions, enabled: !busy })

  return {
    query,
    busy,
    saving: saveDetailsMutation.isPending,
    uploading: uploadLogoMutation.isPending,
    removing: removeLogoMutation.isPending,
    saveDetails: (values: PropertyPatch) =>
      request.run(() => saveDetailsMutation.mutateAsync(values)),
    uploadLogo: (file: File) =>
      request.run(() => uploadLogoMutation.mutateAsync(file)),
    removeLogo: () => request.run(() => removeLogoMutation.mutateAsync()),
  }
}
