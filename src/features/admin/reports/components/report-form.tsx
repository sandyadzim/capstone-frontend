import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { ApiError, getErrorMessage } from '@/lib/api/error'
import { unitsKey } from '@/features/admin/units/unit-queries'
import type { Unit } from '@/features/admin/units/unit-schema'
import type { useCreateReport } from '../hooks/use-create-report'
import {
  reportCreateSchema,
  reportFormSchema,
  reportCategorySchema,
  reportPrioritySchema,
  type ReportFormValues,
} from '../report-schema'
import { reportCategoryLabels, reportPriorityLabels } from '../report-labels'
import { reportFieldErrors } from '../report-utils'
import { ReportUnitPicker } from './report-unit-picker'
import { ImageUploadField } from '@/components/image-upload-field'

export function ReportForm({
  creation,
  onCancel,
  onComplete,
  onReturnToReports,
}: {
  creation: ReturnType<typeof useCreateReport>
  onCancel: () => void
  onComplete: () => Promise<void>
  onReturnToReports: () => void
}) {
  const client = useQueryClient()
  const [unit, setUnit] = useState<Pick<
    Unit,
    'id' | 'unitNumber' | 'floor'
  > | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const feedback = useRef<HTMLDivElement>(null)
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
    defaultValues: {
      unitId: '',
      title: '',
      description: '',
      category: undefined,
      priority: undefined,
    },
  })
  const { errors } = form.formState
  const locked = creation.busy || !!creation.report

  async function submit(values: ReportFormValues) {
    if (locked) return
    try {
      if (await creation.create(reportCreateSchema.parse(values), files))
        await onComplete()
      else requestAnimationFrame(() => feedback.current?.focus())
    } catch (error) {
      const issues = reportFieldErrors(error)
      for (const issue of issues)
        form.setError(issue.path[0], { message: issue.message })
      const unavailableUnit =
        error instanceof ApiError && [404, 409].includes(error.statusCode ?? 0)
      if (unavailableUnit) {
        setUnit(null)
        form.setValue('unitId', '')
        form.setError('unitId', {
          message: 'This unit is no longer available. Choose another unit.',
        })
        await client.invalidateQueries({ queryKey: unitsKey })
      }
      toast.add({
        title: 'Unable to create report',
        description: getErrorMessage(error),
        type: 'error',
      })
      requestAnimationFrame(() => {
        if (unavailableUnit) form.setFocus('unitId')
        else if (issues.length) form.setFocus(issues[0].path[0])
        else feedback.current?.focus()
      })
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(submit, (errors) => {
          const first = (
            ['unitId', 'title', 'description', 'category', 'priority'] as const
          ).find((field) => errors[field])
          if (first) form.setFocus(first)
        })(event)
      }}
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <Controller
        name="unitId"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="report-unit">Unit</FieldLabel>
            <ReportUnitPicker
              unit={unit}
              disabled={locked}
              invalid={fieldState.invalid}
              describedBy={fieldState.invalid ? 'report-unit-error' : undefined}
              inputRef={field.ref}
              onBlur={field.onBlur}
              onSelect={(unit) => {
                setUnit(unit)
                field.onChange(unit.id)
                void form.trigger('unitId')
              }}
            />
            {fieldState.invalid && (
              <FieldError id="report-unit-error" errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
      <Field data-invalid={!!errors.title}>
        <FieldLabel htmlFor="report-title">Title</FieldLabel>
        <Input
          id="report-title"
          {...form.register('title', {
            onChange: (event) => {
              if (event.target.value.trim().length > 160 || errors.title)
                void form.trigger('title')
            },
          })}
          placeholder="Enter report title"
          required
          readOnly={locked}
          className="min-h-11"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'report-title-error' : undefined}
        />
        {errors.title && (
          <FieldError id="report-title-error" errors={[errors.title]} />
        )}
      </Field>
      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="report-description">Description</FieldLabel>
        <Textarea
          id="report-description"
          {...form.register('description')}
          placeholder="Describe the damage or issue"
          required
          readOnly={locked}
          className="min-h-32"
          aria-invalid={!!errors.description}
          aria-describedby={
            errors.description ? 'report-description-error' : undefined
          }
        />
        {errors.description && (
          <FieldError
            id="report-description-error"
            errors={[errors.description]}
          />
        )}
      </Field>
      <Controller
        name="category"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="report-category">Category</FieldLabel>
            <Select
              name={field.name}
              items={reportCategoryLabels}
              value={field.value ?? null}
              disabled={locked}
              onValueChange={(value) => {
                field.onChange(value ?? undefined)
                void form.trigger('category')
              }}
            >
              <SelectTrigger
                id="report-category"
                ref={field.ref}
                onBlur={field.onBlur}
                className="min-h-11 w-full"
                aria-required="true"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? 'report-category-error' : undefined
                }
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {reportCategorySchema.options.map((value) => (
                  <SelectItem key={value} value={value} className="min-h-11">
                    {reportCategoryLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.invalid && (
              <FieldError
                id="report-category-error"
                errors={[fieldState.error]}
              />
            )}
          </Field>
        )}
      />
      <Controller
        name="priority"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="report-priority">Priority</FieldLabel>
            <Select
              name={field.name}
              items={reportPriorityLabels}
              value={field.value ?? null}
              disabled={locked}
              onValueChange={(value) => {
                field.onChange(value ?? undefined)
                void form.trigger('priority')
              }}
            >
              <SelectTrigger
                id="report-priority"
                ref={field.ref}
                onBlur={field.onBlur}
                className="min-h-11 w-full"
                aria-required="true"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? 'report-priority-error' : undefined
                }
              >
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {reportPrioritySchema.options.map((value) => (
                  <SelectItem key={value} value={value} className="min-h-11">
                    {reportPriorityLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.invalid && (
              <FieldError
                id="report-priority-error"
                errors={[fieldState.error]}
              />
            )}
          </Field>
        )}
      />
      <ImageUploadField
        id="report-photos"
        label="Damage photos (optional)"
        maxFiles={5}
        maxSizeMiB={5}
        files={files}
        disabled={locked}
        onChange={setFiles}
      />
      <div ref={feedback} tabIndex={-1} className="outline-none">
        {creation.uploadError && (
          <p role="alert" className="text-sm text-destructive-text">
            {creation.uploadError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {creation.uploadError ? (
          <Button
            type="button"
            className="min-h-11 px-4"
            onClick={onReturnToReports}
          >
            Back to Reports
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-4"
              disabled={creation.busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-11 px-4"
              disabled={locked}
              aria-busy={creation.busy}
            >
              {creation.busy ? 'Loading…' : 'Create report'}
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
