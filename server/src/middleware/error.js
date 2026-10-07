import env from '../config/env.js'
import { ApiError } from '../lib/errors.js'
import { query } from '../config/db.js'
import { logger } from '../lib/logger.js'

/** Postgres error codes we can translate into meaningful HTTP responses. */
const PG_ERRORS = {
  '23505': (err) => {
    if (err.constraint === 'bookings_slot_no_overlap') {
      return ApiError.conflict('SLOT_TAKEN', 'That bay was just taken for an overlapping time window')
    }
    if (err.constraint?.includes('phone')) return ApiError.conflict('PHONE_EXISTS', 'Phone number is already registered')
    return ApiError.conflict('DUPLICATE', 'That record already exists')
  },
  '23503': () => ApiError.badRequest('Referenced record does not exist'),
  '23514': (err) => ApiError.badRequest(`Value violates constraint ${err.constraint ?? ''}`.trim()),
  '22001': () => ApiError.badRequest('Value is too long for its column'),
  '22P02': () => ApiError.badRequest('Malformed identifier or number'),
  '40001': () => ApiError.conflict('SERIALIZATION_FAILURE', 'Concurrent update, please retry'),
  '40P01': () => ApiError.conflict('DEADLOCK', 'Concurrent update, please retry'),
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } })
}

// eslint-disable-next-line no-unused-vars -- express identifies error handlers by arity
export function errorHandler(err, req, res, next) {
  let apiError = err

  if (!(err instanceof ApiError)) {
    const mapped = err?.code && PG_ERRORS[err.code] ? PG_ERRORS[err.code](err) : null
    apiError = mapped ?? ApiError.internal(env.isProduction ? 'Something went wrong' : err?.message)
    if (!mapped) logger.error({ err, path: req.originalUrl }, 'unhandled error')
  }

  if (apiError.status >= 500) {
    logger.error({ code: apiError.code, path: req.originalUrl }, 'request failed')
  } else {
    logger.warn({ code: apiError.code, path: req.originalUrl, message: apiError.message }, 'request rejected')
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  })
}

/** Best-effort audit write; never fails the request that triggered it. */
export async function recordAudit(client, { actor, action, entityType, entityId, before, after, reason, req }) {
  try {
    const runner = client ?? { query }
    await runner.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after, reason, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        actor?.id ?? null,
        actor?.role ?? null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        reason ?? null,
        req?.ip ?? null,
        req?.get?.('user-agent') ?? null,
      ],
    )
  } catch (err) {
    logger.error({ err: err.message, action, entityType }, 'audit write failed')
  }
}
