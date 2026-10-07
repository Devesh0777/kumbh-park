import { query } from '../config/db.js'
import env from '../config/env.js'
import { ApiError } from '../lib/errors.js'
import { normalizePhone, randomNonce, randomOtp, safeEqual, sha256 } from '../lib/crypto.js'
import { hashRefreshToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { logger } from '../lib/logger.js'

const PUBLIC_COLUMNS = `id, phone, name, email, role, photo_url, is_verified, is_suspended,
  suspended_reason, host_since, response_time, upi_id, rating, rating_count, created_at`

const rateWindowMs = 15 * 60 * 1000

/**
 * Issues a 6 digit OTP. Rate limited per phone inside a 15 minute window, and
 * one-time use with a bounded number of attempts.
 */
export async function requestOtp({ phone: rawPhone, purpose = 'login' }) {
  const phone = normalizePhone(rawPhone)
  if (!phone) throw ApiError.badRequest('Enter a valid 10 digit phone number')

  const { rows: recent } = await query(
    `SELECT count(*)::int AS count FROM otp_codes
     WHERE phone = $1 AND created_at > now() - ($2 || ' milliseconds')::interval`,
    [phone, String(rateWindowMs)],
  )
  if (recent[0].count >= env.otpRateLimitPer15Min) {
    throw ApiError.tooMany(`Too many OTP requests. Try again in a few minutes.`)
  }

  const code = randomOtp()
  await query(
    `INSERT INTO otp_codes (phone, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)`,
    [phone, sha256(`${code}:${phone}`), purpose, String(env.otpTtlSeconds)],
  )

  // Real deployment: hand this to an SMS gateway (MSG91 / Twilio / Gupshup).
  if (env.otpExposeInResponse) {
    logger.info({ phone, purpose }, `OTP issued (dev mode, returned in response): ${code}`)
  }

  return {
    phone,
    expiresInSeconds: env.otpTtlSeconds,
    attemptsRemaining: env.otpMaxAttempts,
    ...(env.otpExposeInResponse ? { devOtp: code } : {}),
  }
}

/**
 * Verifies an OTP and returns the user, creating the account on first login.
 * `role` is only honoured when the phone is new, so an existing host cannot be
 * demoted or promoted by re-requesting an OTP.
 */
export async function verifyOtp({ phone: rawPhone, code, name, role = 'pilgrim', hostProfile }) {
  const phone = normalizePhone(rawPhone)
  if (!phone) throw ApiError.badRequest('Enter a valid 10 digit phone number')
  if (!/^\d{6}$/.test(String(code ?? ''))) throw ApiError.badRequest('Enter the 6 digit code')

  const { rows } = await query(
    `SELECT * FROM otp_codes
     WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone],
  )
  const record = rows[0]
  if (!record) throw ApiError.badRequest('That code has expired. Request a new one.')
  if (record.attempts >= env.otpMaxAttempts) {
    await query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [record.id])
    throw ApiError.tooMany('Too many incorrect attempts. Request a new code.')
  }
  if (!safeEqual(record.code_hash, sha256(`${code}:${phone}`))) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [record.id])
    throw ApiError.badRequest('Incorrect code', [{ path: 'code', message: 'Incorrect OTP' }])
  }
  await query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [record.id])

  const existing = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE phone = $1`, [phone])
  let user = existing.rows[0]

  if (!user) {
    const isHost = role === 'host'
    const inserted = await query(
      `INSERT INTO users (phone, name, role, is_verified, host_since, response_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${PUBLIC_COLUMNS}`,
      [
        phone,
        name?.trim() || null,
        isHost ? 'host' : 'pilgrim',
        false,
        isHost ? new Date() : null,
        isHost ? (hostProfile?.responseTime ?? 'within an hour') : null,
      ],
    )
    user = inserted.rows[0]
    logger.info({ userId: user.id, role: user.role }, 'user registered via otp')
  } else if (name && !user.name) {
    const updated = await query(`UPDATE users SET name = $1 WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`, [name.trim(), user.id])
    user = updated.rows[0]
  }

  return user
}

export const findUserByPhone = async (phone) => {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE phone = $1`, [phone])
  return rows[0] ?? null
}

export const findUserById = async (id) => {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id])
  return rows[0] ?? null
}

export const updateProfile = async (id, { name, email, photoUrl, upiId }) => {
  const { rows } = await query(
    `UPDATE users
     SET name = COALESCE($2, name),
         email = COALESCE($3, email),
         photo_url = COALESCE($4, photo_url),
         upi_id = COALESCE($5, upi_id),
         updated_at = now()
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, name ?? null, email ?? null, photoUrl ?? null, upiId ?? null],
  )
  return rows[0] ?? null
}

/** Issues a refresh token and stores only its hash. */
export async function issueRefreshToken(user, { userAgent } = {}) {
  const token = signRefreshToken(user, randomNonce(8))
  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4) RETURNING expires_at`,
    [user.id, sha256(token), String(refreshTtlDays()), userAgent ?? null],
  )
  return { token, expiresAt: rows[0].expires_at }
}

export async function rotateRefreshToken(token, userAgent) {
  const payload = verifyRefreshToken(token)

  const { rows } = await query(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()',
    [hashRefreshToken(token)],
  )
  const stored = rows[0]
  if (!stored || stored.user_id !== payload.sub) {
    throw ApiError.unauthorized('Refresh token is no longer valid')
  }

  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id])
  const user = await findUserById(payload.sub)
  if (!user) throw ApiError.unauthorized('Account no longer exists')
  if (user.is_suspended) throw ApiError.forbidden('Account suspended')

  const next = await issueRefreshToken(user, { userAgent })
  return { user, ...next }
}

export async function revokeRefreshToken(token) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashRefreshToken(token)])
}

/** "30d" -> 30 */
function refreshTtlDays() {
  const match = /^(\d+)([smhd])$/.exec(String(env.refreshTokenTtl))
  if (!match) return 30
  const value = Number(match[1])
  const unit = match[2]
  if (unit === 'd') return value
  if (unit === 'h') return Math.max(1, Math.round(value / 24))
  return 30
}
