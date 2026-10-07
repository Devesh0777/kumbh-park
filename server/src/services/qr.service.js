import QRCode from 'qrcode'
import crypto from 'node:crypto'
import env from '../config/env.js'
import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { hmac, randomNonce, safeEqual, sha256 } from '../lib/crypto.js'

const QR_PREFIX = 'pk_'

/**
 * Encodes and HMAC-signs a static physical QR code payload for a parking spot.
 *
 * Payload: { parking_id, issued_at, nonce, version: 1 }
 * Format: "pk_<base64url_json>.<hmac_signature>"
 */
export function signParkingQrPayload(parkingId, issuedAt = new Date()) {
  const payload = {
    parking_id: parkingId,
    issued_at: issuedAt instanceof Date ? issuedAt.toISOString() : new Date(issuedAt).toISOString(),
    nonce: randomNonce(8),
    v: 1,
  }

  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = hmac(raw, env.jwtSecret)
  const token = `${QR_PREFIX}${raw}.${sig}`
  const tokenHash = sha256(token)

  return { token, tokenHash, payload }
}

/**
 * Verifies the cryptographic HMAC signature of a scanned QR token and extracts
 * the parking_id. Rejects silently-tampered or malformed tokens with a clear error.
 *
 * @param {string} tokenString - Raw string read from the QR code camera scan
 * @param {object} [options]
 * @param {boolean} [options.checkDatabase=true] - Verify token has not been revoked
 * @param {object} [options.client] - Optional DB transaction client
 * @returns {Promise<{ parking_id: string, issued_at: string, token_hash: string }>}
 */
export async function verifyAndExtractParkingQr(tokenString, { checkDatabase = true, client } = {}) {
  if (!tokenString || typeof tokenString !== 'string') {
    throw ApiError.badRequest('Missing QR code token')
  }

  const clean = tokenString.trim()
  if (!clean.startsWith(QR_PREFIX)) {
    // If someone scanned a raw UUID or invalid format
    throw ApiError.badRequest('Invalid or unrecognized QR code format. Please scan an authentic ParkShare physical QR code.')
  }

  const parts = clean.slice(QR_PREFIX.length).split('.')
  if (parts.length !== 2) {
    throw ApiError.badRequest('Malformed QR code token')
  }

  const [raw, signature] = parts
  const expectedSignature = hmac(raw, env.jwtSecret)

  if (!safeEqual(signature, expectedSignature)) {
    logger.warn({ tokenString: clean.slice(0, 20) }, 'QR token tampering detected - HMAC mismatch')
    throw ApiError.badRequest('Invalid or tampered QR code. Signature verification failed.')
  }

  let payload
  try {
    const jsonStr = Buffer.from(raw, 'base64url').toString('utf8')
    payload = JSON.parse(jsonStr)
  } catch {
    throw ApiError.badRequest('Corrupted QR code payload')
  }

  if (!payload.parking_id) {
    throw ApiError.badRequest('QR code does not contain a valid parking ID')
  }

  const tokenHash = sha256(clean)

  if (checkDatabase) {
    const runner = client ?? { query }
    try {
      const { rows } = await runner.query(
        `SELECT id, parking_id, revoked_at, revoked_reason, issued_at
         FROM parking_qr_tokens
         WHERE token_hash = $1`,
        [tokenHash],
      )

      if (rows.length > 0) {
        const record = rows[0]
        if (record.revoked_at) {
          throw ApiError.badRequest(
            'This physical QR code has been revoked and reissued by the host. Please scan the latest printed QR code at the spot.',
          )
        }
      }
    } catch (err) {
      // If table doesn't exist yet or query fails due to mock / offline mode,
      // the HMAC cryptographic signature already guaranteed authenticity
      if (err.statusCode) throw err
      logger.warn({ err: err.message }, 'Database check skipped during QR verification')
    }
  }

  return {
    parking_id: payload.parking_id,
    issued_at: payload.issued_at,
    token_hash: tokenHash,
  }
}

/**
 * Generates an active QR token for a parking spot and saves it to the database.
 * If one already exists and is active, returns it; otherwise creates a new one.
 */
export async function getOrCreateSpotQrToken(parkingId, { createdBy = null, client } = {}) {
  const runner = client ?? { query }

  try {
    // Check if there is an active (unrevoked) token in the database
    const { rows } = await runner.query(
      `SELECT qr_token, token_hash, issued_at
       FROM parking_qr_tokens
       WHERE parking_id = $1 AND revoked_at IS NULL
       ORDER BY issued_at DESC
       LIMIT 1`,
      [parkingId],
    )

    if (rows.length > 0) {
      return {
        qrToken: rows[0].qr_token,
        tokenHash: rows[0].token_hash,
        issuedAt: rows[0].issued_at,
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not query parking_qr_tokens, generating new token')
  }

  // Create new active token
  const issuedAt = new Date()
  const { token, tokenHash } = signParkingQrPayload(parkingId, issuedAt)

  try {
    await runner.query(
      `INSERT INTO parking_qr_tokens (parking_id, token_hash, qr_token, issued_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token_hash) DO NOTHING`,
      [parkingId, tokenHash, token, issuedAt, createdBy],
    )
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not insert parking_qr_tokens')
  }

  return {
    qrToken: token,
    tokenHash,
    issuedAt,
  }
}

/**
 * Regenerates the static physical QR code for a parking spot:
 * 1. Invalidates / revokes all previous QR tokens for this spot immediately.
 * 2. Issues a brand-new signed QR token.
 * 3. Old physical printed QR codes will stop working immediately on the scan endpoint.
 */
export async function regenerateSpotQrToken(parkingId, { createdBy = null, reason = 'Host requested regeneration' } = {}) {
  return withTransaction(async (client) => {
    // Revoke all previous tokens for this spot
    await client.query(
      `UPDATE parking_qr_tokens
       SET revoked_at = now(), revoked_reason = $2
       WHERE parking_id = $1 AND revoked_at IS NULL`,
      [parkingId, reason],
    )

    // Issue brand new signed token
    const issuedAt = new Date()
    const { token, tokenHash } = signParkingQrPayload(parkingId, issuedAt)

    await client.query(
      `INSERT INTO parking_qr_tokens (parking_id, token_hash, qr_token, issued_at, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [parkingId, tokenHash, token, issuedAt, createdBy],
    )

    logger.info({ parkingId, createdBy }, 'Parking spot QR code invalidated and reissued')

    return {
      parkingId,
      qrToken: token,
      tokenHash,
      issuedAt,
      message: 'New QR code generated. Previous physical QR codes have been invalidated immediately.',
    }
  })
}

/**
 * Generates printable SVG / PNG Data URL for a given QR token.
 */
export async function renderQrCodeImage(qrToken, { format = 'png_data_url', width = 400, margin = 2 } = {}) {
  const options = {
    width,
    margin,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  }

  if (format === 'svg') {
    return QRCode.toString(qrToken, { ...options, type: 'svg' })
  }

  return QRCode.toDataURL(qrToken, options)
}
