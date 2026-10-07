/** 4-char human-friendly check-in PIN, unambiguous alphabet */
const PIN_ALPHABET = 'ACDEFHJKLMNPRTUVWXY349'
let pinCounter = 0

export function uid(prefix = 'id') {
  pinCounter += 1
  return `${prefix}_${Date.now().toString(36)}${pinCounter.toString(36)}`
}

export function checkInPin() {
  let out = ''
  for (let i = 0; i < 4; i += 1) {
    out += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)]
  }
  return out
}

/** Deterministic booking code: NPC-7F3K9 */
export function bookingCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `NPC-${out}`
}

/**
 * Payload encoded into the QR image. In production this is a signed token
 * the host scans; the mock renders the booking id so the code is readable.
 */
export function qrPayload(booking) {
  if (!booking) return 'NPC1|b_demo|NPC-DEMO|s1|MH15AB1234'
  return [
    'NPC1',
    booking.id || 'b_demo',
    booking.code || 'NPC-DEMO',
    booking.spotId || 's1',
    booking.plate || 'MH 15 AB 1234',
    booking.startISO || booking.start || new Date().toISOString(),
    booking.endISO || booking.end || new Date(Date.now() + 7200000).toISOString(),
    booking.pin || '4829',
  ].join('|')
}

export function quoteSummary(spot, duration) {
  const { hours, plan } = duration
  const base = plan === 'day' ? spot.priceDay * Math.max(1, Math.round(hours / 24)) : spot.priceHour * hours
  const serviceFee = Math.round(base * 0.06)
  const gst = Math.round((base + serviceFee) * 0.18)
  return {
    plan,
    hours,
    base,
    serviceFee,
    gst,
    total: base + serviceFee + gst,
  }
}
