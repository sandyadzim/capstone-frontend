import { getErrorMessage } from '@/lib/api/error'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { toast } from '@/components/ui/toast'
import { unitFormSchema, type UnitCreate, type Unit } from '../unit-schema'
import { changedUnitFields, unitFieldErrors } from '../unit-utils'

export function UnitForm({
  unit,
  busy,
  onSave,
}: {
  unit?: Unit
  busy: boolean
  onSave: (values: UnitCreate) => Promise<unknown>
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    control,
  } = useForm<z.input<typeof unitFormSchema>, unknown, UnitCreate>({
    resolver: zodResolver(unitFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      unitNumber: unit?.unitNumber ?? '',
      floor: unit ? String(unit.floor) : '',
      maintenanceFlag: unit?.maintenanceFlag ?? false,
    },
  })
  const values = unitFormSchema.safeParse(useWatch({ control }))
  const unchanged =
    unit &&
    values.success &&
    Object.keys(changedUnitFields(unit, values.data)).length === 0

  async function submit(values: UnitCreate) {
    if (busy || unchanged) return
    try {
      await onSave(values)
    } catch (error) {
      for (const issue of unitFieldErrors(error)) {
        if (
          issue.path[0] === 'unitNumber' ||
          issue.path[0] === 'floor' ||
          issue.path[0] === 'maintenanceFlag'
        )
          setError(
            issue.path[0],
            { message: issue.message },
            { shouldFocus: true },
          )
      }
      toast.add({
        title: 'Unable to save unit',
        description: getErrorMessage(error),
        type: 'error',
      })
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(submit)}
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <Field
        data-invalid={!!errors.unitNumber}
        className="data-[invalid=true]:text-destructive-text"
      >
        <FieldLabel htmlFor="unit-number">Unit Name</FieldLabel>
        <Input
          id="unit-number"
          {...register('unitNumber')}
          placeholder="e.g. A-101"
          required
          readOnly={busy}
          className="min-h-11"
          aria-invalid={!!errors.unitNumber}
          aria-describedby={errors.unitNumber ? 'unit-number-error' : undefined}
        />
        {errors.unitNumber && (
          <FieldError
            id="unit-number-error"
            className="text-destructive-text"
            errors={[errors.unitNumber]}
          />
        )}
      </Field>
      <Field
        data-invalid={!!errors.floor}
        className="data-[invalid=true]:text-destructive-text"
      >
        <FieldLabel htmlFor="unit-floor">Floor</FieldLabel>
        <Input
          id="unit-floor"
          {...register('floor')}
          placeholder="e.g. 1"
          inputMode="text"
          required
          readOnly={busy}
          className="min-h-11"
          aria-invalid={!!errors.floor}
          aria-describedby={errors.floor ? 'unit-floor-error' : undefined}
        />
        {errors.floor && (
          <FieldError
            id="unit-floor-error"
            className="text-destructive-text"
            errors={[errors.floor]}
          />
        )}
      </Field>
      <Controller
        name="maintenanceFlag"
        control={control}
        render={({ field }) => (
          <Field data-invalid={!!errors.maintenanceFlag}>
            <FieldLabel htmlFor="unit-maintenance" className="min-h-11 gap-3">
              <Checkbox
                id="unit-maintenance"
                name={field.name}
                ref={field.ref}
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                disabled={busy}
                className="size-5"
                aria-invalid={!!errors.maintenanceFlag}
                aria-describedby={`unit-maintenance-help${errors.maintenanceFlag ? ' unit-maintenance-error' : ''}`}
              />
              Under maintenance
            </FieldLabel>
            <p
              id="unit-maintenance-help"
              className="text-sm text-muted-foreground"
            >
              Maintenance takes priority over occupancy in the displayed status.
              Resident placement stays unchanged.
            </p>
            {errors.maintenanceFlag && (
              <FieldError
                id="unit-maintenance-error"
                className="text-destructive-text"
                errors={[errors.maintenanceFlag]}
              />
            )}
          </Field>
        )}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          className="min-h-11 px-4"
          disabled={busy || !!unchanged}
          aria-busy={busy}
        >
          {busy && (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {busy ? 'Saving…' : unit ? 'Save changes' : 'Create unit'}
        </Button>
      </div>
    </form>
  )
}
