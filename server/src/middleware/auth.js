import { verifyAccessToken } from '../lib/jwt.js'
import { ApiError } from '../lib/errors.js'
import { asyncHandler } from '../lib/http.js'
import { safeEqual } from '../lib/crypto.js'
import { query } from '../config/db.js'
import env from '../config/env.js'

const bearer = (req) => {
  const header = req.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

/** Verifies the access token and loads a fresh user row (catches suspensions). */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = bearer(req)
  if (!token) throw ApiError.unauthorized('Missing bearer token')

  const payload = verifyAccessToken(token)
  const { rows } = await query(
    'SELECT id, phone, name, email, role, photo_url, is_verified, is_suspended, suspended_reason, host_since, response_time, upi_id, rating, rating_count, created_at FROM users WHERE id = $1',
    [payload.sub],
  )
  const user = rows[0]
  if (!user) throw ApiError.unauthorized('Account no longer exists')
  if (user.is_suspended) throw ApiError.forbidden(`Account suspended: ${user.suspended_reason ?? 'contact support'}`)

  req.user = user
  req.tokenPayload = payload
  next()
})

/** Attaches req.user when a valid token is present, but never fails the request. */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = bearer(req)
  if (!token) return next()
  try {
    return await authenticate(req, res, next)
  } catch {
    return next()
  }
})

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized())
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`))
  }
  next()
}

export const requireVerifiedHost = (req, res, next) => {
  if (req.user?.role !== 'host') return next(ApiError.forbidden('Hosts only'))
  if (!req.user.is_verified) return next(ApiError.forbidden('Host account is not verified yet'))
  next()
}

/**
 * Machine-to-machine auth for the ML/pricing service. The surge endpoints are
 * called by another service, not by a logged-in user.
 */
export const requireServiceKey = (req, res, next) => {
  const provided = req.get('x-service-key')
  if (!provided || !safeEqual(provided, env.serviceKey)) {
    return next(ApiError.forbidden('Invalid or missing X-Service-Key'))
  }
  next()
}
