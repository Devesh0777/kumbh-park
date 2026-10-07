import crypto from 'node:crypto'
import env from '../config/env.js'

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

export const hmac = (value, secret = env.jwtSecret) =>
  crypto.createHmac('sha256', secret).update(String(value)).digest('base64url')

export const randomOtp = () => String(crypto.randomInt(100000, 1000000))

export const randomPin = () => String(crypto.randomInt(100000, 1000000))

export const randomNonce = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url')

export const bookingCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)]
  return `NPC-${out}`
}

/** Constant-time compare that tolerates unequal lengths. */
export const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export const normalizePhone = (phone) => {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '')
  if (!/^\+?\d{10,15}$/.test(digits)) return null
  return digits.startsWith('+') ? digits : `+${digits}`
}

export const maskPhone = (phone) => {
  const value = String(phone ?? '')
  return value.length < 4 ? '***' : `${value.slice(0, 3)}****${value.slice(-2)}`
}
