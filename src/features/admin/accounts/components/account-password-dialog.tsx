import { useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/api/error'
import {
  accountPasswordSchema,
  type Account,
  type AccountPassword,
} from '../account-schema'
import { accountFieldErrors } from '../account-utils'

export function AccountPasswordDialog({
  open,
  account,
  own,
  busy,
  finalFocus,
  onChangePassword,
  onClose,
}: {
  open: boolean
  account: Account
  own: boolean
  busy: boolean
  finalFocus: RefObject<HTMLElement | null>
  onChangePassword: (password: string) => Promise<Account | undefined>
  onClose: () => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const form = useForm<AccountPassword>({
    resolver: zodResolver(accountPasswordSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  function close() {
    if (!busy) {
      form.reset()
      setShowPassword(false)
      setShowConfirmation(false)
      onClose()
    }
  }
  async function submit(values: AccountPassword) {
    if (busy) return
    let result: Account | undefined
    try {
      result = await onChangePassword(values.password)
    } catch (error) {
      for (const issue of accountFieldErrors(error))
        if (issue.path[0] === 'password')
          form.setError(
            'password',
            { message: issue.message },
            { shouldFocus: true },
          )
      toast.add({
        title: 'Unable to change password',
        description: getErrorMessage(error),
        type: 'error',
      })
      return
    }
    if (result) {
      form.reset()
      setShowPassword(false)
      setShowConfirmation(false)
      onClose()
    }
  }
  return (
    <Dialog
      open={open}
      disablePointerDismissal={busy}
      onOpenChange={(next, details) => {
        if (!next) {
          if (busy) details.cancel()
          else close()
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-md"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle className="text-lg leading-6 wrap-anywhere">
            Change password for {account.name}
          </DialogTitle>
          <DialogDescription className="leading-6">
            All sessions for this account will end.
            {own
              ? ' You will need to sign in again with the new password.'
              : ''}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className="space-y-5"
        >
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="account-new-password">New password</FieldLabel>
            <div className="relative">
              <Input
                id="account-new-password"
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
                placeholder="Enter new password"
                autoComplete="new-password"
                autoCapitalize="none"
                spellCheck={false}
                required
                readOnly={busy}
                className="min-h-11 pr-12"
                aria-invalid={!!errors.password}
                aria-describedby={`account-new-password-help${errors.password ? ' account-new-password-error' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 size-11"
                disabled={busy}
                aria-label={
                  showPassword ? 'Hide new password' : 'Show new password'
                }
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
              id="account-new-password-help"
              className="text-sm leading-6 text-muted-foreground"
            >
              Use 4–30 characters.
            </p>
            {errors.password && (
              <FieldError
                id="account-new-password-error"
                errors={[errors.password]}
              />
            )}
          </Field>
          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="account-confirm-password">
              Confirm password
            </FieldLabel>
            <div className="relative">
              <Input
                id="account-confirm-password"
                {...form.register('confirmPassword', {
                  onChange: async (event) => {
                    const value: string = event.target.value
                    if (value.length > 30 || errors.confirmPassword)
                      await form.trigger('confirmPassword')
                  },
                })}
                type={showConfirmation ? 'text' : 'password'}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                autoCapitalize="none"
                spellCheck={false}
                required
                readOnly={busy}
                className="min-h-11 pr-12"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword
                    ? 'account-confirm-password-error'
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
                  showConfirmation
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
                aria-pressed={showConfirmation}
                onClick={() => setShowConfirmation((previous) => !previous)}
              >
                {showConfirmation ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <FieldError
                id="account-confirm-password-error"
                errors={[errors.confirmPassword]}
              />
            )}
          </Field>
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-4"
              disabled={busy}
              onClick={close}
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
              {busy ? 'Saving…' : 'Change password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
