import env from '../config/env.js'

const round2 = (value) => Math.round(value * 100) / 100

/**
 * Single source of truth for money. The frontend mock mirrors this exactly, so
 * the quoted total in the sheet matches the amount persisted on the booking.
 *
 * base = hourly rate * hours (or daily rate * days)
 * surge = base * (multiplier - 1)   -> only when multiplier > 1
 * platform fee = base+surge scaled by platform fee %
 */
export function quote({ pricePerHour, pricePerDay, hours, multiplier = 1, plan = 'hourly', platformFeePct = env.platformFeePct }) {
  const safeHours = Math.max(Number(hours) || 0, 0.25)
  const base =
    plan === 'daily'
      ? Number(pricePerDay) * Math.max(1, Math.round(safeHours / 24))
      : Number(pricePerHour) * safeHours

  const applied = Number(multiplier) > 1 ? Number(multiplier) : 1
  const surge = base * (applied - 1)
  const fee = (base + surge) * (platformFeePct / 100)
  const total = base + surge + fee

  return {
    hours: round2(safeHours),
    plan,
    baseAmount: round2(base),
    surgeMultiplier: applied,
    surgeApplied: applied > 1,
    surgeAmount: round2(surge),
    platformFee: round2(fee),
    total: round2(total),
    hostPayout: round2(total - fee),
    currency: env.currency,
  }
}

/** Picks the strongest (highest) multiplier whose window overlaps the booking. */
export function pickMultiplier(windows, startISO, endISO) {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  const overlapping = (windows ?? []).filter((w) => {
    const wStart = new Date(w.windowStart).getTime()
    const wEnd = new Date(w.windowEnd).getTime()
    return wStart < end && wEnd > start
  })
  if (overlapping.length === 0) return { multiplier: 1, matched: null }
  const best = overlapping.reduce((a, b) => (Number(b.multiplier) > Number(a.multiplier) ? b : a))
  return { multiplier: Number(best.multiplier), matched: best }
}

export const hoursBetween = (startISO, endISO) =>
  round2((new Date(endISO).getTime() - new Date(startISO).getTime()) / 3_600_000)

export { round2 }
