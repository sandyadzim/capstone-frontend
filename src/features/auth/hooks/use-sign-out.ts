import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from '@/components/ui/toast'
import { signOut } from '../auth-session'

export function useSignOut() {
  const client = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => signOut(client),
    gcTime: 0,
    onError: () => {
      toast.add({
        title: 'Unable to sign out',
        description: 'Unable to sign out. Check your connection and try again.',
        type: 'error',
        priority: 'high',
        timeout: 10000,
      })
    },
    onSuccess: async () => {
      router.clearCache()
      await router.navigate({
        to: '/login',
        search: { redirect: undefined, reason: undefined },
        replace: true,
      })
      await router.invalidate()
    },
  })
}
