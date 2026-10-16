import { useRef, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ImageUploadField } from '@/components/image-upload-field'
import { ReportPhotos } from '@/features/admin/reports/components/report-photos'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/error'
import {
  completionDefaults,
  completionFileError,
  completionFormSchema,
  type CompletionReport,
  type CompletionValues,
} from './completion-schema'
import type { useCompleteTask } from './use-complete-task'
import { CompletionCostItems } from './completion-cost-items'
import { CompletionReceiptField } from './completion-receipt-field'

const resultFields = [
  ['inspectionResult', 'Inspection findings'],
  ['problemFound', 'Problem found'],
  ['repairAction', 'Repair action'],
  ['additionalNotes', 'Additional notes (optional)'],
] as const
const issueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
})

export function CompletionForm({
  report,
  completion,
  disabled,
}: {
  report: CompletionReport
  completion: ReturnType<typeof useCompleteTask>
  disabled: boolean
}) {
  const navigate = useNavigate()
  const feedback = useRef<HTMLParagraphElement>(null)
  const [fileError, setFileError] = useState<{
    field: 'photos' | 'receipt'
    message: string
  }>()
  const form = useForm<CompletionValues>({
    resolver: zodResolver(completionFormSchema),
    defaultValues: completionDefaults(report),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const locked = completion.busy || disabled

  async function submit(values: CompletionValues) {
    if (locked) return
    const files = completionFileError(
      report,
      completion.photos,
      completion.receipt,
    )
    setFileError(files)
    if (files) {
      document
        .getElementById(
          files.field === 'receipt' ? 'work-receipt' : 'work-repair-photos',
        )
        ?.focus()
      return
    }
    try {
      const completed = await completion.submit(report, values)
      if (!completed) return
      toast.add({
        title: 'Task completed',
        description: 'Your work is awaiting administrator review.',
        type: 'success',
      })
      await navigate({
        to: '/technician/tasks/$reportId',
        params: { reportId: report.id },
      })
    } catch (error) {
      let first: FieldPath<CompletionValues> | undefined
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        const details = z
          .object({ issues: z.array(z.unknown()) })
          .safeParse(error.details)
        for (const raw of details.success ? details.data.issues : []) {
          const issue = issueSchema.safeParse(raw)
          if (!issue.success) continue
          const [name, rawIndex, field] = issue.data.path
          const index =
            typeof rawIndex === 'string' && /^\d+$/.test(rawIndex)
              ? Number(rawIndex)
              : rawIndex
          let path: FieldPath<CompletionValues> | undefined
          if (resultFields.some(([key]) => key === name))
            path = resultFields.find(([key]) => key === name)?.[0]
          if (
            name === 'items' &&
            typeof index === 'number' &&
            Number.isInteger(index) &&
            index >= 0 &&
            index < values.items.length &&
            (field === 'type' || field === 'description' || field === 'price')
          )
            path = `items.${index}.${field}`
          if (path) {
            form.setError(path, { message: issue.data.message })
            first ??= path
          }
        }
      }
      requestAnimationFrame(() => {
        if (first) form.setFocus(first)
        else feedback.current?.focus()
      })
    }
  }

  return (
    <>
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
        className="space-y-6"
      >
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-sm font-semibold wrap-anywhere">
            Unit {report.unit.unitNumber} · Floor {report.unit.floor}
          </p>
          <p className="mt-2 text-sm leading-6 wrap-anywhere">{report.title}</p>
        </div>
        <fieldset disabled={locked} className="min-w-0 space-y-5">
          {resultFields.map(([name, label]) => {
            const error = form.formState.errors[name]
            return (
              <div key={name} className="space-y-2">
                <label
                  htmlFor={`work-${name}`}
                  className="block text-sm font-medium"
                >
                  {label}
                </label>
                <Textarea
                  id={`work-${name}`}
                  className="min-h-28 text-base md:text-base"
                  {...form.register(name)}
                  required={name !== 'additionalNotes'}
                  aria-invalid={!!error}
                  aria-describedby={error ? `work-${name}-error` : undefined}
                />
                {error && (
                  <p
                    id={`work-${name}-error`}
                    role="alert"
                    className="text-sm text-destructive-text"
                  >
                    {error.message}
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>
        <CompletionCostItems form={form} disabled={locked} />
        <section
          aria-labelledby="work-photos-heading"
          className="space-y-4 border-t pt-6"
        >
          <h2 id="work-photos-heading" className="text-lg font-semibold">
            Repair photos{' '}
            <span className="text-sm font-normal text-muted-foreground">
              (optional)
            </span>
          </h2>
          {report.repairPhotos.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Saved photos</p>
              <ReportPhotos
                photos={report.repairPhotos}
                label="Repair photos"
              />
            </div>
          )}
          {report.repairPhotos.length < 5 ? (
            <ImageUploadField
              id="work-repair-photos"
              label="Add repair photos"
              files={completion.photos}
              onChange={(files) => {
                completion.setPhotos(files)
                setFileError(undefined)
              }}
              disabled={locked}
              maxFiles={5 - report.repairPhotos.length}
              maxSizeMiB={5}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Five repair photos saved. No more photos can be added.
            </p>
          )}
          {fileError?.field === 'photos' && (
            <p role="alert" className="text-sm text-destructive-text">
              {fileError.message}
            </p>
          )}
        </section>
        <CompletionReceiptField
          saved={report.receipt}
          file={completion.receipt}
          onChange={completion.setReceipt}
          disabled={locked}
          error={fileError?.field === 'receipt' ? fileError.message : undefined}
          onError={(message) =>
            setFileError(message ? { field: 'receipt', message } : undefined)
          }
        />
        {completion.feedback && (
          <p
            ref={feedback}
            tabIndex={-1}
            role="alert"
            className="text-sm leading-6 text-destructive-text outline-none wrap-anywhere"
          >
            {completion.feedback}
          </p>
        )}
        <footer className="flex flex-wrap justify-end gap-3 border-t pt-5">
          <Button
            nativeButton={false}
            role="link"
            variant="outline"
            className="min-h-11"
            disabled={completion.busy}
            render={
              <Link
                to="/technician/tasks/$reportId"
                params={{ reportId: report.id }}
              />
            }
          >
            Cancel
          </Button>
          <Button type="submit" className="min-h-11" disabled={locked}>
            Complete task
          </Button>
        </footer>
      </form>
    </>
  )
}
