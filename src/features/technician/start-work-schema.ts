import { z } from 'zod'

export const startWorkFormSchema = z
  .object({
    arrivalDate: z
      .string()
      .refine(
        (value) => z.iso.date().safeParse(value).success,
        'Choose an estimated arrival date.',
      ),
    arrivalTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter an estimated arrival time.'),
  })
  .superRefine(({ arrivalDate, arrivalTime }, context) => {
    if (
      !z.iso.date().safeParse(arrivalDate).success ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime)
    )
      return
    const arrival = Date.parse(`${arrivalDate}T${arrivalTime}:00+07:00`)
    if (arrival > Date.now()) return
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    context.addIssue({
      code: 'custom',
      path: [arrivalDate < today ? 'arrivalDate' : 'arrivalTime'],
      message: 'Choose an arrival date and time later than now (WIB).',
    })
  })
export const startWorkSchema = z.strictObject({
  estimatedArrivalAt: z.iso.datetime({ offset: true }),
})
export type StartWorkForm = z.infer<typeof startWorkFormSchema>
export type StartWork = z.infer<typeof startWorkSchema>

export function startWorkPayload(values: StartWorkForm): StartWork {
  const { arrivalDate, arrivalTime } = startWorkFormSchema.parse(values)
  // Calendar and clock fields are a WIB wall time, regardless of device zone.
  return {
    estimatedArrivalAt: new Date(
      `${arrivalDate}T${arrivalTime}:00+07:00`,
    ).toISOString(),
  }
}
