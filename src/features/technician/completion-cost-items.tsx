import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CompletionValues } from './completion-schema'

export function CompletionCostItems({
  form,
  disabled,
}: {
  form: UseFormReturn<CompletionValues>
  disabled: boolean
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })
  const errors = form.formState.errors.items
  return (
    <section
      aria-labelledby="work-costs-heading"
      className="space-y-4 border-t pt-6"
    >
      <h2 id="work-costs-heading" className="text-lg font-semibold">
        Costs{' '}
        <span className="text-sm font-normal text-muted-foreground">
          (optional)
        </span>
      </h2>
      {!fields.length && (
        <p className="text-sm leading-6 text-muted-foreground">
          No cost items. A receipt is still required.
        </p>
      )}
      {fields.map((item, index) => (
        <fieldset
          key={item.id}
          className="min-w-0 space-y-4 rounded-xl border p-4"
          disabled={disabled}
          aria-labelledby={`cost-${index}-heading`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id={`cost-${index}-heading`} className="text-sm font-medium">
              Cost item {index + 1}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-destructive-text hover:bg-destructive/10 hover:text-destructive-text"
              disabled={disabled}
              aria-label={`Remove cost item ${index + 1}`}
              onClick={() => remove(index)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor={`cost-${index}-type`}
                className="text-sm font-medium"
              >
                Type
              </label>
              <Controller
                control={form.control}
                name={`items.${index}.type`}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    items={{ SERVICE: 'Service', MATERIAL: 'Material' }}
                    disabled={disabled}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger
                      id={`cost-${index}-type`}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className="min-h-11 w-full"
                      aria-invalid={!!errors?.[index]?.type}
                      aria-describedby={
                        errors?.[index]?.type
                          ? `cost-${index}-type-error`
                          : undefined
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICE" className="min-h-11">
                        Service
                      </SelectItem>
                      <SelectItem value="MATERIAL" className="min-h-11">
                        Material
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors?.[index]?.type && (
                <p
                  id={`cost-${index}-type-error`}
                  role="alert"
                  className="text-sm text-destructive-text"
                >
                  {errors[index].type.message}
                </p>
              )}
            </div>
            {(['description', 'price'] as const).map((name) => {
              const label = {
                description: 'Description',
                price: 'Price',
              }[name]
              const error = errors?.[index]?.[name]
              const id = `cost-${index}-${name}`
              return (
                <div key={name} className="space-y-2">
                  <label htmlFor={id} className="block text-sm font-medium">
                    {label}
                  </label>
                  {name === 'price' ? (
                    <Controller
                      control={form.control}
                      name={`items.${index}.price`}
                      render={({ field }) => (
                        <NumberInput
                          id={id}
                          name={field.name}
                          ref={field.ref}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={disabled}
                          prefix="IDR"
                          maxIntegerDigits={21}
                          aria-invalid={!!error}
                          aria-describedby={error ? `${id}-error` : undefined}
                        />
                      )}
                    />
                  ) : (
                    <Input
                      id={id}
                      className="min-h-11"
                      {...form.register(`items.${index}.description`)}
                      aria-invalid={!!error}
                      aria-describedby={error ? `${id}-error` : undefined}
                    />
                  )}
                  {error && (
                    <p
                      id={`${id}-error`}
                      role="alert"
                      className="text-sm text-destructive-text"
                    >
                      {error.message}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={disabled}
        onClick={() =>
          append({
            type: 'SERVICE',
            description: '',
            price: '',
          })
        }
      >
        <Plus aria-hidden="true" />
        Add cost item
      </Button>
    </section>
  )
}
