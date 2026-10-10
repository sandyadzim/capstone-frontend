import { z } from 'zod'

export const timestampSchema = z.iso.datetime({ offset: true })
export const moneySchema = z.string().regex(/^\d+\.\d{2}$/)
