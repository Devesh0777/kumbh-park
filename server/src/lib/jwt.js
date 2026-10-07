import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import { ApiError } from './errors.js'
import { sha256 } from './crypto.js'

export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, phone: user.phone, name: user.name },
    env.jwtSecret,
    { expiresIn: env.accessTokenTtl, issuer: 'nashik-parking' },
  )

export const signRefreshToken = (user, nonce) =>
  jwt.sign({ sub: user.id, nonce }, env.jwtRefreshSecret, { expiresIn: env.refreshTokenTtl, issuer: 'nashik-parking' })

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: 'nashik-parking' })
  } catch (err) {
    throw new ApiError(401, err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN', 'Invalid or expired token')
  }
}

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.jwtRefreshSecret, { issuer: 'nashik-parking' })
  } catch {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired')
  }
}

export const hashRefreshToken = (token) => sha256(token)

/**
 * Booking QR payload. Deliberately compact so it fits comfortably in a QR even
 * for long plate numbers, and signed so a host scanner can reject tampering
 * without a database round trip.
 */
export const signCheckInToken = ({ bookingId, code, pinNonce, slotCode }) =>
  jwt.sign({ b: bookingId, c: code, n: pinNonce, s: slotCode }, env.jwtSecret, {
    expiresIn: '36h',
    issuer: 'nashik-parking',
  })

export const verifyCheckInToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: 'nashik-parking' })
  } catch {
    throw new ApiError(400, 'INVALID_QR', 'This check-in code is invalid or has expired')
  }
}
