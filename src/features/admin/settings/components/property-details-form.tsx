import { useForm } from 'react-hook-form'
import { LoaderCircle } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { propertyDetailsSchema, type PropertyDetails } from '../settings-schema'
import { showSettingsError } from '../settings-utils'

export function PropertyDetailsForm({
  property,
  busy,
  saving,
  onSave,
}: {
  property: PropertyDetails
  busy: boolean
  saving: boolean
  onSave: (values: PropertyDetails) => Promise<unknown>
}) {
  const {
    register,
    handleSubmit,
    trigger,
    clearErrors,
    formState: { errors },
  } = useForm<PropertyDetails>({
    resolver: zodResolver(propertyDetailsSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { name: property.name, address: property.address },
  })

  async function onSubmit(values: PropertyDetails) {
    if (busy) return
    try {
      await onSave(values)
    } catch (error) {
      showSettingsError('Unable to save property details', error)
    }
  }

  return (
    <form noValidate className="mt-5" onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="property-name">Name</FieldLabel>
          <Input
            {...register('name', {
              onChange: async (event) => {
                if (event.target.value.trim()) await trigger('name')
                else clearErrors('name')
              },
            })}
            defaultValue={property.name}
            id="property-name"
            required
            autoComplete="organization"
            readOnly={busy}
            className="min-h-11"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'property-name-error' : undefined}
          />
          {errors.name && (
            <FieldError id="property-name-error" errors={[errors.name]} />
          )}
        </Field>
        <Field data-invalid={!!errors.address}>
          <FieldLabel htmlFor="property-address">Address</FieldLabel>
          <Textarea
            {...register('address')}
            id="property-address"
            required
            autoComplete="street-address"
            readOnly={busy}
            className="min-h-28 resize-y"
            aria-invalid={!!errors.address}
            aria-describedby={
              errors.address ? 'property-address-error' : undefined
            }
          />
          {errors.address && (
            <FieldError id="property-address-error" errors={[errors.address]} />
          )}
        </Field>
      </FieldGroup>
      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          disabled={busy}
          aria-busy={saving}
          className="min-h-11 px-4"
        >
          {saving && (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          )}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
