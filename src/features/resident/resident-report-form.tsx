import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { SheetFooter } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUploadField } from '@/components/image-upload-field'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import {
  reportCreateSchema,
  reportFormSchema,
} from '@/features/admin/reports/report-schema'
import {
  reportCategoryLabels,
  reportPriorityLabels,
} from '@/features/admin/reports/report-labels'
import { reportFieldErrors } from '@/features/admin/reports/report-utils'
import type { useCreateReport } from '@/features/admin/reports/hooks/use-create-report'
import { residentUnitQueryOptions } from './resident-queries'

const formSchema = reportFormSchema.omit({ unitId: true })
const fieldOrder = ['title', 'description', 'category', 'priority'] as const

export function ResidentReportForm({
  actorId,
  creation,
  onCancel,
}: {
  actorId: string
  creation: ReturnType<typeof useCreateReport>
  onCancel: () => void
}) {
  const unit = useQuery(residentUnitQueryOptions(actorId))
  const placement = unit.data?.unit
  const feedback = useRef<HTMLParagraphElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>()
  const [checkingPlacement, setCheckingPlacement] = useState(false)
  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
    defaultValues: {
      title: '',
      description: '',
      category: undefined,
      priority: undefined,
    },
  })
  const { errors } = form.formState
  const locked = creation.busy || !!creation.report
  const canSubmit = !!placement && !unit.isError && !checkingPlacement

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        void form.handleSubmit(
          async (values) => {
            if (locked || !canSubmit) return
            setError(undefined)
            try {
              await creation.create(
                reportCreateSchema.parse({ ...values, unitId: placement.id }),
                files,
              )
            } catch (error) {
              const issues = reportFieldErrors(error)
              for (const issue of issues) {
                if (issue.path[0] !== 'unitId')
                  form.setError(issue.path[0], { message: issue.message })
              }
              setError(getErrorMessage(error))
              if (
                error instanceof ApiError &&
                [403, 404, 409].includes(error.statusCode ?? 0)
              ) {
                setCheckingPlacement(true)
                await unit.refetch()
                setCheckingPlacement(false)
              }
              requestAnimationFrame(() => {
                const first = fieldOrder.find((field) =>
                  issues.some((issue) => issue.path[0] === field),
                )
                if (first) form.setFocus(first)
                else feedback.current?.focus()
              })
            }
          },
          (errors) => {
            const first = fieldOrder.find((field) => errors[field])
            if (first) form.setFocus(first)
          },
        )(event)
      }}
    >
      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="resident-report-title">Title</FieldLabel>
          <Input
            id="resident-report-title"
            {...form.register('title', {
              onChange: (event) => {
                if (event.target.value.trim().length > 160 || errors.title)
                  void form.trigger('title')
              },
            })}
            placeholder="What needs attention?"
            required
            readOnly={locked}
            className="min-h-11"
            aria-invalid={!!errors.title}
            aria-describedby={
              errors.title ? 'resident-report-title-error' : undefined
            }
          />
          {errors.title && (
            <FieldError
              id="resident-report-title-error"
              errors={[errors.title]}
            />
          )}
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="resident-report-description">
            Description
          </FieldLabel>
          <Textarea
            id="resident-report-description"
            {...form.register('description')}
            placeholder="Describe the issue and where it is happening"
            required
            readOnly={locked}
            className="min-h-28"
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description
                ? 'resident-report-description-error'
                : undefined
            }
          />
          {errors.description && (
            <FieldError
              id="resident-report-description-error"
              errors={[errors.description]}
            />
          )}
        </Field>
        {(['category', 'priority'] as const).map((name) => {
          const labels =
            name === 'category' ? reportCategoryLabels : reportPriorityLabels
          const label = name === 'category' ? 'Category' : 'Priority'
          const id = `resident-report-${name}`
          return (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={id}>{label}</FieldLabel>
                  <Select
                    name={field.name}
                    items={labels}
                    value={field.value ?? null}
                    disabled={locked}
                    onValueChange={(value) => {
                      field.onChange(value ?? undefined)
                      void form.trigger(name)
                    }}
                  >
                    <SelectTrigger
                      id={id}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className="min-h-11 w-full"
                      aria-required="true"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        [
                          fieldState.invalid ? `${id}-error` : '',
                          name === 'priority' ? `${id}-help` : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    >
                      <SelectValue placeholder={`Select ${name}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(labels).map(([value, label]) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="min-h-11"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {name === 'priority' && (
                    <p
                      id={`${id}-help`}
                      className="text-sm leading-6 text-muted-foreground"
                    >
                      Admin will review your report and confirm the final
                      priority.
                    </p>
                  )}
                  {fieldState.invalid && (
                    <FieldError
                      id={`${id}-error`}
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />
          )
        })}
        <ImageUploadField
          id="resident-report-photos"
          label="Damage photos (optional)"
          maxFiles={5}
          maxSizeMiB={5}
          files={files}
          disabled={locked}
          onChange={setFiles}
        />
        {error && (
          <p
            ref={feedback}
            tabIndex={-1}
            role="alert"
            className="text-sm leading-6 text-destructive-text outline-none wrap-anywhere"
          >
            {error}
          </p>
        )}
      </div>
      <SheetFooter className="shrink-0 flex-row justify-end border-t px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-4"
          disabled={locked}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="min-h-11 px-4"
          disabled={locked || !canSubmit}
          aria-busy={creation.busy}
        >
          Submit report
        </Button>
      </SheetFooter>
    </form>
  )
}
