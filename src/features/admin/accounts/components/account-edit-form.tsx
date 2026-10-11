import { useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  accountEditSchema,
  type Account,
  type AccountEdit,
  type AccountPatch,
} from '../account-schema'
import {
  accountFieldErrors,
  accountRoleLabels,
  changedAccountFields,
} from '../account-utils'
import { AccountConfirmationDialog } from './account-confirmation-dialog'

export function AccountEditForm({
  account,
  own,
  busy,
  onSave,
  onSaved,
  onCancel,
}: {
  account: Account
  own: boolean
  busy: boolean
  onSave: (values: AccountPatch) => Promise<Account | undefined>
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  // Keep the loaded baseline and draft stable when the same account refreshes.
  const [baseline] = useState(account)
  const [confirmation, setConfirmation] = useState<AccountEdit | null>(null)
  const [firstError, setFirstError] = useState<string | null>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  const form = useForm<AccountEdit>({
    resolver: zodResolver(accountEditSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: baseline.name,
      loginIdentifier: baseline.loginIdentifier,
      role: baseline.role,
    },
  })
  const draft = useWatch({ control: form.control })
  const parsed = accountEditSchema.safeParse(draft)
  const unchanged =
    parsed.success &&
    Object.keys(changedAccountFields(baseline, parsed.data)).length === 0
  const { errors } = form.formState

  async function save(values: AccountEdit) {
    if (busy) return
    const patch = changedAccountFields(baseline, values)
    if (!Object.keys(patch).length) return
    let result: Account | undefined
    try {
      result = await onSave(patch)
    } catch (error) {
      let first = true
      for (const issue of accountFieldErrors(error)) {
        const name = issue.path[0]
        if (name === 'name' || name === 'loginIdentifier' || name === 'role') {
          form.setError(
            name,
            { message: issue.message },
            { shouldFocus: first },
          )
          if (first) setFirstError(`account-${name}`)
          first = false
        }
      }
      setConfirmation(null)
      toast.add({
        title: 'Unable to update account',
        description: getErrorMessage(error),
        type: 'error',
      })
      return
    }
    if (result) await onSaved()
  }

  function submit(values: AccountEdit) {
    if (busy) return
    setFirstError(null)
    if (
      changedAccountFields(baseline, values).role !== undefined &&
      account.role === 'RESIDENT' &&
      account.activeUnit &&
      values.role !== 'RESIDENT'
    )
      setConfirmation(values)
    else void save(values)
  }

  return (
    <>
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
            placeholder="Enter full name"
            autoComplete="off"
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
        <Controller
          name="role"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="account-role">Role</FieldLabel>
              <Select
                required
                name={field.name}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  void form.trigger('role')
                }}
                disabled={busy || own}
                items={accountRoleLabels}
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
                      own ? 'account-role-help' : '',
                      fieldState.invalid ? 'account-role-error' : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  <SelectValue />
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
              {own && (
                <p
                  id="account-role-help"
                  className="text-sm leading-6 text-muted-foreground"
                >
                  You cannot change your own administrator role.
                </p>
              )}
              {fieldState.invalid && (
                <FieldError
                  id="account-role-error"
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
            ref={saveRef}
            type="submit"
            className="min-h-11 px-4"
            disabled={busy || unchanged}
            aria-busy={busy}
          >
            {busy && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
      <AccountConfirmationDialog
        open={confirmation !== null}
        busy={busy}
        title="Change resident role?"
        description={`Changing the role releases this resident from ${account.activeUnit?.unitNumber ?? 'their unit'}. Their account history remains available.`}
        confirmLabel="Save changes"
        destructive
        finalFocus={() =>
          (firstError && document.getElementById(firstError)) || saveRef.current
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) void save(confirmation)
        }}
      />
    </>
  )
}
