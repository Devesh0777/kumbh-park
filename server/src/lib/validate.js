import { z } from 'zod'
import { ApiError } from './errors.js'

const formats = [
  z.string().datetime({ offset: true }),
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/),
  z.string().date(),
]

/** Accepts ISO-8601 with or without an explicit offset. */
export const isoDateTime = z
  .string()
  .refine((value) => formats.some((f) => f.safeParse(value).success), { message: 'Expected an ISO-8601 date-time' })
  .transform((value) => (value.length === 10 ? `${value}T00:00:00.000Z` : value))

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const phone = z
  .string()
  .min(10)
  .max(16)
  .transform((v) => v.replace(/[^\d+]/g, ''))
  .refine((v) => /^\+?\d{10,15}$/.test(v), 'Expected a valid phone number')

export const uuid = z.string().uuid()
/**
 * Zone ids are stable text slugs (`ramkund`, `sadashiv-gaon`), not UUIDs - see
 * `id text PRIMARY KEY` in sql/001_init.sql. Validating these as uuid rejected
 * every seeded zone, so spot creation and the surge hook always failed.
 */
export const zoneId = z.string().min(2).max(64)
export const vehicleType = z.enum(['2w', 'car', 'bus'])
export const vehicleNumber = z
  .string()
  .min(6)
  .max(15)
  .transform((v) => v.toUpperCase().replace(/\s+/g, ''))
  .refine((v) => /^[A-Z0-9]{6,15}$/.test(v), 'Expected a valid vehicle number, e.g. MH15AB1234')

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

/**
 * Middleware factory: validates and replaces req.body / req.query / req.params.
 * Query objects are frozen by Express 5, so they are copied before mutation.
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {})
    if (schemas.params) req.params = schemas.params.parse(req.params ?? {})
    if (schemas.query) {
      Object.assign(req.query, schemas.query.parse(req.query ?? {}))
    }
    next()
  } catch (err) {
    if (err instanceof z.ZodError) {
      const details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      next(ApiError.badRequest('Request validation failed', details))
      return
    }
    next(err)
  }
}
