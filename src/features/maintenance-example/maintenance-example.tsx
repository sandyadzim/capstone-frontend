import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  maintenanceExampleSchema,
  type MaintenanceExampleValues,
} from './schema'

export function MaintenanceExample() {
  const [submitted, setSubmitted] = useState<MaintenanceExampleValues | null>(
    null,
  )
  const form = useForm<MaintenanceExampleValues>({
    resolver: zodResolver(maintenanceExampleSchema),
    defaultValues: { title: '', description: '' },
    mode: 'onSubmit',
  })

  function reset() {
    form.reset()
    setSubmitted(null)
  }

  return (
    <div className="max-w-2xl space-y-7">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
            Maintenance request
          </h1>
          <Badge variant="secondary">Example</Badge>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
          Try a request form. Your entries stay on this page and are not sent to
          a property team.
        </p>
      </div>
      <Card>
        <CardContent>
          <form
            id="maintenance-example"
            noValidate
            onChange={() => setSubmitted(null)}
            onSubmit={form.handleSubmit((values) => setSubmitted(values))}
          >
            <FieldGroup>
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="request-title">
                      Request title
                    </FieldLabel>
                    <Input
                      {...field}
                      id="request-title"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid
                          ? 'title-help title-error'
                          : 'title-help'
                      }
                      className="min-h-11"
                      placeholder="e.g. Kitchen tap is leaking"
                      required
                      maxLength={100}
                      autoComplete="off"
                    />
                    <FieldDescription id="title-help">
                      A short summary, between 5 and 100 characters.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError
                        id="title-error"
                        errors={[fieldState.error]}
                      />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="request-description">
                      Description
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="request-description"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid
                          ? 'description-help description-error'
                          : 'description-help'
                      }
                      className="min-h-36 resize-y"
                      placeholder="Where is the issue, and what is happening?"
                      required
                      maxLength={1000}
                      rows={5}
                    />
                    <FieldDescription id="description-help">
                      Include the location and any useful details. 10–1,000
                      characters.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError
                        id="description-error"
                        errors={[fieldState.error]}
                      />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-4"
            onClick={reset}
          >
            Reset
          </Button>
          <Button
            type="submit"
            form="maintenance-example"
            className="min-h-11 px-4"
            disabled={form.formState.isSubmitting}
          >
            Preview submission
          </Button>
        </CardFooter>
      </Card>
      <section role="status" aria-live="polite" aria-atomic="true">
        {submitted && (
          <div className="rounded-xl bg-secondary p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 aria-hidden="true" className="size-4" /> Example
              validated
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This is a local preview. No request was created.
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium">Title</dt>
                <dd className="mt-1 wrap-anywhere whitespace-pre-wrap text-muted-foreground">
                  {submitted.title}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Description</dt>
                <dd className="mt-1 wrap-anywhere whitespace-pre-wrap text-muted-foreground">
                  {submitted.description}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </div>
  )
}
