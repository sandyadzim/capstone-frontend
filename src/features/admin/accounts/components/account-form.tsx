import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/api/error'
import {
  accountCreateSchema,
  accountFormSchema,
  type Account,
  type AccountCreate,
  type AccountFormValues,
} from '../account-schema'
import { accountFieldErrors } from '../account-utils'

export function AccountForm({
  initialRole,
  busy,
  onCreate,
  onCreated,
  onCancel,
}: {
  initialRole?: Account['role']
  busy: boolean
  onCreate: (values: AccountCreate) => Promise<Account | undefined>
  onCreated: (account: Account) => Promise<void>
  onCancel: () => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      loginIdentifier: '',
      password: '',
      confirmPassword: '',
      role: initialRole,
      isActive: true,
    },
  })
  const role = useWatch({ control: form.control, name: 'role' })
  const { errors } = form.formState

  async function submit(values: AccountFormValues) {
    if (busy) return
    let account: Account | undefined
    try {
      account = await onCreate(accountCreateSchema.parse(values))
    } catch (error) {
      const issues = accountFieldErrors(error)
      for (const [index, issue] of issues.entries())
        form.setError(
          issue.path[0],
          { message: issue.message },
          { shouldFocus: index === 0 },
        )
      toast.add({
        title: 'Unable to create account',
        description: getErrorMessage(error),
        type: 'error',
      })
      return
    }
    if (account) {
      form.reset()
      setShowPassword(false)
      setShowConfirmPassword(false)
      await onCreated(account)
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submit)}
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="account-name">Name</FieldLabel>
        <Input
          id="account-name"
          {...form.register('name', {
            onChange: async (event) => {
              const value: string = event.target.value
              if (value.trim().length > 160 || errors.name)
                await form.trigger('name')
            },
          })}
          type="text"
          placeholder="Enter full name"
          autoComplete="off"
          spellCheck={true}
          required
          readOnly={busy}
          className="min-h-11"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'account-name-error' : undefined}
        />
        {errors.name && (
          <FieldError id="account-name-error" errors={[errors.name]} />
        )}
      </Field>
      <Field data-invalid={!!errors.loginIdentifier}>
        <FieldLabel htmlFor="account-loginIdentifier">Login ID</FieldLabel>
        <Input
          id="account-loginIdentifier"
          {...form.register('loginIdentifier', {
            onChange: async (event) => {
              const value: string = event.target.value
              if (
                value.trim().toLowerCase().length > 254 ||
                errors.loginIdentifier
              )
                await form.trigger('loginIdentifier')
            },
          })}
          type="text"
          placeholder="Enter login ID"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          readOnly={busy}
          className="min-h-11"
          aria-invalid={!!errors.loginIdentifier}
          aria-describedby={`account-loginIdentifier-help${errors.loginIdentifier ? ' account-loginIdentifier-error' : ''}`}
        />
        <p
          id="account-loginIdentifier-help"
          className="text-sm leading-6 text-muted-foreground"
        >
          Login IDs are saved in lowercase and must be unique, including
          inactive accounts.
        </p>
        {errors.loginIdentifier && (
          <FieldError
            id="account-loginIdentifier-error"
            errors={[errors.loginIdentifier]}
          />
        )}
      </Field>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="account-password">Password</FieldLabel>
        <div className="relative">
          <Input
            id="account-password"
            {...form.register('password', {
              onChange: async (event) => {
                const value: string = event.target.value
                if (value.length > 30 || errors.password)
                  await form.trigger('password')
                if (form.getValues('confirmPassword'))
                  await form.trigger('confirmPassword')
              },
            })}
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter password"
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            readOnly={busy}
            className="min-h-11 pr-12"
            aria-invalid={!!errors.password}
            aria-describedby={`account-password-help${errors.password ? ' account-password-error' : ''}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 size-11"
            disabled={busy}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((previous) => !previous)}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        <p
          id="account-password-help"
          className="text-sm leading-6 text-muted-foreground"
        >
          Use 4–30 characters.
        </p>
        {errors.password && (
          <FieldError id="account-password-error" errors={[errors.password]} />
        )}
      </Field>
      <Field data-invalid={!!errors.confirmPassword}>
        <FieldLabel htmlFor="account-confirmPassword">
          Confirm password
        </FieldLabel>
        <div className="relative">
          <Input
            id="account-confirmPassword"
            {...form.register('confirmPassword', {
              onChange: async (event) => {
                const value: string = event.target.value
                if (value.length > 30 || errors.confirmPassword)
                  await form.trigger('confirmPassword')
              },
            })}
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Re-enter password"
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            readOnly={busy}
            className="min-h-11 pr-12"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword
                ? 'account-confirmPassword-error'
                : undefined
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 size-11"
            disabled={busy}
            aria-label={
              showConfirmPassword
                ? 'Hide confirm password'
                : 'Show confirm password'
            }
            aria-pressed={showConfirmPassword}
            onClick={() => setShowConfirmPassword((previous) => !previous)}
          >
            {showConfirmPassword ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        {errors.confirmPassword && (
          <FieldError
            id="account-confirmPassword-error"
            errors={[errors.confirmPassword]}
          />
        )}
      </Field>
      <Controller
        name="role"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="account-role">Role</FieldLabel>
            <Select
              required
              name={field.name}
              value={field.value ?? null}
              onValueChange={(value) => {
                field.onChange(value)
                void form.trigger('role')
              }}
              disabled={busy}
              items={{
                RESIDENT: 'Resident',
                TECHNICIAN: 'Technician',
                ADMIN: 'Administrator',
              }}
            >
              <SelectTrigger
                id="account-role"
                ref={field.ref}
                onBlur={field.onBlur}
                className="min-h-11 w-full"
                aria-invalid={fieldState.invalid}
                aria-required="true"
                aria-describedby={
                  [
                    role === 'RESIDENT' ? 'account-role-help' : '',
                    fieldState.invalid ? 'account-role-error' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESIDENT" className="min-h-11">
                  Resident
                </SelectItem>
                <SelectItem value="TECHNICIAN" className="min-h-11">
                  Technician
                </SelectItem>
                <SelectItem value="ADMIN" className="min-h-11">
                  Administrator
                </SelectItem>
              </SelectContent>
            </Select>
            {role === 'RESIDENT' && (
              <p
                id="account-role-help"
                className="text-sm leading-6 text-muted-foreground"
              >
                This resident will be created without a unit. Place them later
                from Unit management.
              </p>
            )}
            {fieldState.invalid && (
              <FieldError id="account-role-error" errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
      <Controller
        name="isActive"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="account-active" className="min-h-11 gap-3">
              <Checkbox
                id="account-active"
                name={field.name}
                ref={field.ref}
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                disabled={busy}
                className="size-5"
                aria-invalid={fieldState.invalid}
                aria-describedby={`account-active-help${fieldState.invalid ? ' account-active-error' : ''}`}
              />
              Active account
            </FieldLabel>
            <p
              id="account-active-help"
              className="text-sm leading-6 text-muted-foreground"
            >
              Inactive accounts cannot sign in.
            </p>
            {fieldState.invalid && (
              <FieldError
                id="account-active-error"
                errors={[fieldState.error]}
              />
            )}
          </Field>
        )}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-4"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="min-h-11 px-4"
          disabled={busy}
          aria-busy={busy}
        >
          {busy && (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}
