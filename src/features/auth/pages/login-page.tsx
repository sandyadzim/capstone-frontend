import { getErrorMessage } from '@/lib/api/error'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { AuthLayout } from '../components/auth-layout'
import { roleHome, safeRedirect } from '../auth-guards'
import { loginSchema, type LoginValues } from '../auth-schema'
import {
  SessionVerificationError,
  sessionQueryOptions,
  signIn,
  verifyLogin,
} from '../auth-session'
import { SessionUnavailable } from '../components/session-feedback'

export function LoginPage({
  redirect,
  expired = false,
}: {
  redirect?: string
  expired?: boolean
}) {
  const client = useQueryClient()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [verification, setVerification] = useState(false)
  const expirationShown = useRef(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { loginIdentifier: '', password: '' },
  })
  const login = useMutation({
    mutationFn: (values: LoginValues | undefined) =>
      values ? signIn(client, values) : verifyLogin(client),
    gcTime: 0,
    onSuccess: async (actor) => {
      form.reset()
      router.clearCache()
      await router.navigate({
        href: safeRedirect(redirect) ?? roleHome[actor.role],
        replace: true,
      })
      await router.invalidate()
    },
    onError: (cause) => {
      setVerification(cause instanceof SessionVerificationError)
      toast.add({
        title: 'Unable to sign in',
        description: getErrorMessage(cause),
        type: 'error',
        priority: 'high',
      })
      form.resetField('password')
    },
  })
  const session = useQuery({
    ...sessionQueryOptions(client),
    enabled: !login.isPending && !verification,
  })
  useEffect(() => {
    if (expired && !expirationShown.current) {
      expirationShown.current = true
      toast.add({
        title: 'Session expired',
        description: 'Your session has expired. Sign in again.',
        type: 'warning',
      })
    }
  }, [expired])
  useEffect(() => {
    if (session.data && !session.isError && !login.isPending) {
      router.clearCache()
      void router.navigate({
        href: safeRedirect(redirect) ?? roleHome[session.data.role],
        replace: true,
      })
    }
  }, [session.data, session.isError, login.isPending, redirect, router])
  if (session.isError && !verification)
    return (
      <SessionUnavailable
        busy={session.isFetching}
        retry={() => {
          void session.refetch()
        }}
      />
    )
  return (
    <AuthLayout>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Sign in to access your Property portal.
      </p>
      <form
        className="mt-8"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          if (login.isPending) return
          setVerification(false)
          await login.mutateAsync(values).catch(() => undefined)
        })}
      >
        <FieldGroup>
          <Controller
            name="loginIdentifier"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-id">Login ID</FieldLabel>
                <Input
                  {...field}
                  id="login-id"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  readOnly={login.isPending}
                  className="min-h-11"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? 'login-id-error' : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError id="login-id-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    {...field}
                    id="login-password"
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    readOnly={login.isPending}
                    className="min-h-11 pr-12"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? 'password-error' : undefined
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 size-11"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    onClick={() => setVisible((value) => !value)}
                  >
                    {visible ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </Button>
                </div>
                {fieldState.invalid && (
                  <FieldError id="password-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        {verification && (
          <Button
            type="button"
            variant="outline"
            className="mt-5 min-h-11 w-full px-4"
            disabled={login.isPending}
            onClick={() => {
              login.mutate(undefined)
            }}
          >
            Check session again
          </Button>
        )}
        <Button
          type="submit"
          className="mt-6 min-h-11 w-full px-4"
          disabled={login.isPending}
          aria-busy={login.isPending}
        >
          {login.isPending ? 'Loading…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
