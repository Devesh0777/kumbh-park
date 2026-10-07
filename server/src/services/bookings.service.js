import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { hoursBetween, pickMultiplier, quote } from '../lib/pricing.js'
import { bookingCode, randomPin, safeEqual, sha256 } from '../lib/crypto.js'
import { signCheckInToken, verifyCheckInToken } from '../lib/jwt.js'
import { recordAudit } from '../middleware/error.js'
import env from '../config/env.js'

const BOOKING_COLUMNS = `
  b.id, b.code, b.spot_id, b.user_id, b.slot_id, b.pricing_plan, b.start_time, b.end_time,
  b.hours, b.base_amount, b.surge_multiplier, b.surge_applied, b.surge_amount, b.platform_fee,
  b.amount, b.status, b.vehicle_number, b.vehicle_type, b.check_in_pin_hash, b.qr_token,
  b.notes, b.checked_in_at, b.checked_out_at, b.pin_attempts,
  b.cancelled_at, b.cancellation_reason, b.refund_amount, b.created_at`

const MIN_LEAD_MINUTES = 30
const MAX_ADVANCE_DAYS = 60

/** Rejects windows that are malformed, in the past, or beyond the booking horizon. */
export function assertBookableWindow({ startISO, endISO, minHours, maxHours }) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Invalid start or end time')
  }
  if (end <= start) throw ApiError.badRequest('End time must be after start time')

  const now = Date.now()
  if (start.getTime() < now + MIN_LEAD_MINUTES * 60_000) {
    throw ApiError.badRequest(`Bookings must start at least ${MIN_LEAD_MINUTES} minutes from now`)
  }
  if (start.getTime() > now + MAX_ADVANCE_DAYS * 86_400_000) {
    throw ApiError.badRequest(`Bookings can only be made up to ${MAX_ADVANCE_DAYS} days ahead`)
  }

  const hours = hoursBetween(startISO, endISO)
  if (minHours && hours < Number(minHours)) {
    throw ApiError.badRequest(`This spot has a ${minHours} hour minimum`)
  }
  if (maxHours && hours > Number(maxHours)) {
    throw ApiError.badRequest(`This spot allows up to ${maxHours} hours per booking`)
  }
  return { start, end, hours }
}

/** GET /bookings/quote - price preview using the same code path as booking. */
export async function quoteBooking({ spotId, startISO, endISO, vehicleType = 'car', plan = 'hourly' }) {
  const { rows } = await query(
    `SELECT s.id, s.price_per_hour, s.price_per_day, s.min_booking_hours, s.max_booking_hours,
            s.title, s.zone_id
     FROM parking_spots s
     WHERE s.id = $1 AND s.status = 'verified'`,
    [spotId],
  )
  const spot = rows[0]
  if (!spot) throw ApiError.notFound('Parking spot not found')

  assertBookableWindow({
    startISO,
    endISO,
    minHours: spot.min_booking_hours,
    maxHours: spot.max_booking_hours,
  })

  const surge = await activeSurge(spot.zone_id, startISO, endISO)
  const pricing = quote({
    pricePerHour: spot.price_per_hour,
    pricePerDay: spot.price_per_day,
    hours: hoursBetween(startISO, endISO),
    multiplier: surge.multiplier,
    plan,
  })

  const free = await freeBayCount(spot.id, vehicleType, startISO, endISO)
  return {
    spotId: spot.id,
    spotTitle: spot.title,
    zoneId: spot.zone_id,
    vehicleType,
    start: startISO,
    end: endISO,
    pricing,
    surge: surge.matched
      ? {
          reason: surge.matched.reason,
          multiplier: Number(surge.matched.multiplier),
          windowStart: surge.matched.window_start,
          windowEnd: surge.matched.window_end,
        }
      : null,
    baysFree: free,
    instantBook: true,
  }
}

const freeBayCount = async (spotId, vehicleType, startISO, endISO) => {
  const { rows } = await query(
    `SELECT count(*)::int AS free
     FROM slots sl
     WHERE sl.spot_id = $1 AND sl.vehicle_type = $2 AND sl.is_currently_available
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.slot_id = sl.id AND b.status IN ('confirmed', 'checked_in')
           AND b.time_window && tstzrange($3::timestamptz, $4::timestamptz)
       )`,
    [spotId, vehicleType, startISO, endISO],
  )
  return rows[0].free
}

async function activeSurge(zoneId, startISO, endISO) {
  const { rows } = await query(
    `SELECT zone_id, multiplier, reason, window_start, window_end
     FROM zone_demand
     WHERE zone_id = $1
       AND window_start < $3::timestamptz AND window_end > $2::timestamptz
     ORDER BY multiplier DESC`,
    [zoneId, startISO, endISO],
  )
  return pickMultiplier(rows, startISO, endISO)
}

/**
 * POST /bookings
 *
 * Concurrency strategy, in order of importance:
 *  1. Row-lock candidate bays with `FOR UPDATE SKIP LOCKED` so two simultaneous
 *     requests can never pick the same bay.
 *  2. Re-check overlap inside the lock (the EXCLUDE constraint is the last line
 *     of defence, and is mapped to a 409 SLOT_TAKEN in the error handler).
 *  3. Everything - surge re-read, pricing, slot claim, booking insert, audit -
 *     happens in one transaction, so the quoted total can never drift from the
 *     charged total.
 */
export async function createBooking(userId, payload, req) {
  const { spotId, startISO, endISO, vehicleNumber, vehicleType = 'car', plan = 'hourly', notes } = payload

  return withTransaction(async (client) => {
    const { rows: spotRows } = await client.query(
      `SELECT s.*, u.name AS host_name, u.is_verified AS host_verified
       FROM parking_spots s JOIN users u ON u.id = s.host_id
       WHERE s.id = $1 FOR SHARE OF s`,
      [spotId],
    )
    const spot = spotRows[0]
    if (!spot) throw ApiError.notFound('Parking spot not found')
    if (spot.status !== 'verified') throw ApiError.badRequest('This spot is not accepting bookings')
    if (!spot.is_accepting) throw ApiError.badRequest('This host has paused bookings')
    if (spot.host_id === userId) throw ApiError.badRequest('You cannot book your own spot')

    const { hours } = assertBookableWindow({
      startISO,
      endISO,
      minHours: spot.min_booking_hours,
      maxHours: spot.max_booking_hours,
    })

    // 1. Lock a free bay. SKIP LOCKED means a concurrent transaction holding
    //    this row is simply skipped, so the loser retries the next candidate.
    const { rows: slotRows } = await client.query(
      `SELECT sl.id
       FROM slots sl
       WHERE sl.spot_id = $1
         AND sl.vehicle_type = $2
         AND sl.is_currently_available
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.slot_id = sl.id AND b.status IN ('confirmed', 'checked_in')
             AND b.time_window && tstzrange($3::timestamptz, $4::timestamptz)
         )
       ORDER BY sl.code NULLS LAST, sl.id
       FOR UPDATE OF sl SKIP LOCKED
       LIMIT 1`,
      [spotId, vehicleType, startISO, endISO],
    )
    const slot = slotRows[0]
    if (!slot) {
      throw ApiError.conflict('NO_BAYS_FREE', `No ${vehicleType} bay is free for that time window`)
    }

    // 2. Re-verify under the lock.
    const { rows: clash } = await client.query(
      `SELECT 1 FROM bookings b
       WHERE b.slot_id = $1 AND b.status IN ('confirmed', 'checked_in')
         AND b.time_window && tstzrange($2::timestamptz, $3::timestamptz)
       LIMIT 1`,
      [slot.id, startISO, endISO],
    )
    if (clash.length) throw ApiError.conflict('SLOT_TAKEN', 'That bay was just taken for this time window')

    // 3. Price inside the transaction so the stored total matches the quote.
    const surge = await activeSurge(spot.zone_id, startISO, endISO)
    const pricing = quote({
      pricePerHour: spot.price_per_hour,
      pricePerDay: spot.price_per_day,
      hours,
      multiplier: surge.multiplier,
      plan,
    })

    const pin = randomPin()
    const qrToken = sha256(`${spotId}:${userId}:${startISO}:${pin}`).slice(0, 40)

    const { rows } = await client.query(
      `INSERT INTO bookings (
         code, spot_id, user_id, slot_id, pricing_plan, start_time, end_time, hours,
         base_amount, surge_multiplier, surge_applied, surge_amount, platform_fee, amount,
         status, vehicle_number, vehicle_type, notes, check_in_pin_hash, qr_token)
       VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9,$10,$11,$12,$13,$14,'confirmed',$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        bookingCode(),
        spotId,
        userId,
        slot.id,
        plan,
        startISO,
        endISO,
        pricing.hours,
        pricing.baseAmount,
        pricing.surgeMultiplier,
        pricing.surgeApplied,
        pricing.surgeAmount,
        pricing.platformFee,
        pricing.total,
        vehicleNumber,
        vehicleType,
        notes ?? null,
        sha256(pin),
        qrToken,
      ],
    )
    const bookingId = rows[0].id

    // The PIN is returned once, at creation, and never stored in plaintext.
    const booking = await getBookingById(bookingId, userId, { client })
    await recordAudit(client, {
      actor: { id: userId, role: 'pilgrim' },
      action: 'booking.create',
      entityType: 'booking',
      entityId: bookingId,
      after: { spotId, slotId: slot.id, start: startISO, end: endISO, total: pricing.total },
      req,
    })

    return { ...booking, pinCode: pin }
  })
}

export async function getBookingById(id, requesterId, { client, asHost = false } = {}) {
  const runner = client ?? { query }
  const { rows } = await runner.query(
    `SELECT ${BOOKING_COLUMNS},
            s.title AS spot_title, s.address AS spot_address, s.latitude, s.longitude,
            s.gate_instructions, s.check_in_from, s.check_out_by,
            z.name AS zone_name, z.slug AS zone_slug,
            s.host_id, h.name AS host_name, h.phone AS host_phone,
            u.name AS user_name, u.phone AS user_phone
     FROM bookings b
     JOIN parking_spots s ON s.id = b.spot_id
     JOIN zones z ON z.id = s.zone_id
     JOIN users h ON h.id = s.host_id
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1`,
    [id],
  )
  const row = rows[0]
  if (!row) throw ApiError.notFound('Booking not found')

  // A booking is visible to its pilgrim and to the host of the spot only.
  const isOwner = requesterId && String(requesterId) === String(row.user_id)
  const isSpotHost = asHost && String(requesterId) === String(row.host_id)
  if (!isOwner && !isSpotHost) throw ApiError.forbidden('You do not have access to this booking')

  return shapeBooking(row, { includePin: isOwner })
}

export const listUserBookings = async (userId, { scope = 'upcoming', page = 1, pageSize = 20 }) => {
  const filters = {
    upcoming: `b.status = 'confirmed' AND b.end_time > now()`,
    past: `b.end_time <= now() OR b.status IN ('completed', 'cancelled')`,
    cancelled: `b.status = 'cancelled'`,
    active: `b.status = 'checked_in'`,
  }
  const where = filters[scope] ?? filters.upcoming

  const { rows } = await query(
    `SELECT ${BOOKING_COLUMNS}, s.title AS spot_title, s.address AS spot_address,
            s.latitude, s.longitude, z.name AS zone_name, z.slug AS zone_slug,
            s.host_id, h.name AS host_name, u.name AS user_name
     FROM bookings b
     JOIN parking_spots s ON s.id = b.spot_id
     JOIN zones z ON z.id = s.zone_id
     JOIN users h ON h.id = s.host_id
     JOIN users u ON u.id = b.user_id
     WHERE b.user_id = $1 AND ${where}
     ORDER BY b.start_time ASC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, (page - 1) * pageSize],
  )
  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total FROM bookings b WHERE b.user_id = $1 AND ${where}`,
    [userId],
  )
  return { items: rows.map((row) => shapeBooking(row)), total: countRows[0].total }
}

export const listHostBookings = async (hostId, { scope = 'today', page = 1, pageSize = 50 }) => {
  const filters = {
    today: `b.start_time::date = current_date AND b.status <> 'cancelled'`,
    upcoming: `b.start_time > now() AND b.status = 'confirmed'`,
    active: `b.status = 'checked_in'`,
    completed: `b.status = 'completed'`,
    all: `b.status <> 'cancelled'`,
  }
  const where = filters[scope] ?? filters.today

  const { rows } = await query(
    `SELECT ${BOOKING_COLUMNS}, s.title AS spot_title, s.address AS spot_address,
            s.latitude, s.longitude, z.name AS zone_name, z.slug AS zone_slug,
            s.host_id, h.name AS host_name, u.name AS user_name, u.phone AS user_phone,
            EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_review
     FROM bookings b
     JOIN parking_spots s ON s.id = b.spot_id
     JOIN zones z ON z.id = s.zone_id
     JOIN users h ON h.id = s.host_id
     JOIN users u ON u.id = b.user_id
     WHERE s.host_id = $1 AND ${where}
     ORDER BY b.start_time ASC
     LIMIT $2 OFFSET $3`,
    [hostId, pageSize, (page - 1) * pageSize],
  )
  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total
     FROM bookings b JOIN parking_spots s ON s.id = b.spot_id
     WHERE s.host_id = $1 AND ${where}`,
    [hostId],
  )
  return { items: rows.map((row) => shapeBooking(row, { includePin: true })), total: countRows[0].total }
}

/**
 * POST /bookings/:id/cancel
 * Cancellation is a state transition guarded by the current status inside the
 * same transaction, so a double-tap cannot produce two refunds.
 */
export async function cancelBooking(id, userId, reason, req) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, status, amount, start_time, host_id, user_id
       FROM bookings WHERE id = $1 FOR UPDATE`,
      [id],
    )
    const booking = rows[0]
    if (!booking) throw ApiError.notFound('Booking not found')
    if (String(booking.user_id) !== String(userId)) throw ApiError.forbidden('Not your booking')
    if (booking.status === 'cancelled') throw ApiError.badRequest('Booking is already cancelled')
    if (booking.status === 'checked_in') throw ApiError.badRequest('Cannot cancel a booking that is already checked in')
    if (booking.status === 'completed') throw ApiError.badRequest('Cannot cancel a completed booking')

    const hoursToStart = (new Date(booking.start_time).getTime() - Date.now()) / 3_600_000
    // Full refund up to 2h before start, 50% within 2h, none after start.
    const refundAmount =
      hoursToStart >= 2 ? Number(booking.amount) : hoursToStart > 0 ? Number(booking.amount) / 2 : 0

    const { rows: updated } = await client.query(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $2, refund_amount = $3
       WHERE id = $1 RETURNING id`,
      [id, reason ?? null, refundAmount],
    )
    await recordAudit(client, {
      actor: { id: userId, role: 'pilgrim' },
      action: 'booking.cancel',
      entityType: 'booking',
      entityId: id,
      before: { status: booking.status },
      after: { status: 'cancelled', refundAmount },
      reason,
      req,
    })
    return { id: updated[0].id, status: 'cancelled', refundAmount }
  })
}

/** Builds the short-lived token embedded in the QR payload. */
export const buildQrToken = (booking) => signCheckInToken({ bookingId: booking.id, slotId: booking.slot_id, userId: booking.user_id })

/**
 * POST /bookings/:id/checkin
 * Authorised by the check-in JWT from the QR scan, or by the 6 digit PIN as a
 * manual fallback. Either way the booking is locked first.
 */
export async function checkIn(id, { actor, pin, token, req }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT b.*, s.title AS spot_title, s.host_id, s.check_in_from, s.latitude, s.longitude
       FROM bookings b JOIN parking_spots s ON s.id = b.spot_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [id],
    )
    const booking = rows[0]
    if (!booking) throw ApiError.notFound('Booking not found')
    if (booking.status === 'checked_in') throw ApiError.badRequest('Already checked in')
    if (booking.status === 'cancelled') throw ApiError.badRequest('This booking was cancelled')
    if (booking.status === 'completed') throw ApiError.badRequest('This booking is already complete')

    if (token) {
      const payload = verifyCheckInToken(token)
      if (payload.bookingId !== booking.id) throw ApiError.forbidden('QR code does not match this booking')
    } else if (pin) {
      if (!safeEqual(sha256(String(pin)), booking.check_in_pin_hash)) {
        await recordAudit(client, {
          actor: { id: actor?.id, role: actor?.role },
          action: 'booking.checkin.pin_failed',
          entityType: 'booking',
          entityId: id,
          req,
        })
        throw ApiError.forbidden('Incorrect PIN')
      }
    } else {
      throw ApiError.badRequest('Provide either a QR token or a PIN')
    }

    // The host is confirming arrival, so they may check in any of their bookings.
    const isHost = actor?.id && String(actor.id) === String(booking.host_id)
    const isOwner = actor?.id && String(actor.id) === String(booking.user_id)
    if (!isHost && !isOwner) throw ApiError.forbidden('You cannot check in this booking')

    const { rows: updated } = await client.query(
      `UPDATE bookings SET status = 'checked_in', checked_in_at = now() WHERE id = $1 RETURNING id, checked_in_at`,
      [id],
    )
    await recordAudit(client, {
      actor: { id: actor.id, role: actor.role },
      action: 'booking.checkin',
      entityType: 'booking',
      entityId: id,
      before: { status: booking.status },
      after: { status: 'checked_in' },
      req,
    })
    return { id: updated[0].id, status: 'checked_in', checkedInAt: updated[0].checked_in_at, spotTitle: booking.spot_title }
  })
}

/** POST /bookings/:id/checkout - releases the bay and queues a payout row. */
export async function checkOut(id, { actor, req }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT b.*, s.host_id, s.title AS spot_title FROM bookings b
       JOIN parking_spots s ON s.id = b.spot_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [id],
    )
    const booking = rows[0]
    if (!booking) throw ApiError.notFound('Booking not found')
    if (booking.status !== 'checked_in') throw ApiError.badRequest('Only a checked-in booking can be checked out')

    const isHost = actor?.id && String(actor.id) === String(booking.host_id)
    const isAdmin = actor?.role === 'admin'
    if (!isHost && !isAdmin) throw ApiError.forbidden('Only the host can check a vehicle out')

    const { rows: updated } = await client.query(
      `UPDATE bookings SET status = 'completed', checked_out_at = now() WHERE id = $1 RETURNING id, checked_out_at`,
      [id],
    )

    const payout = Number(booking.amount) - Number(booking.platform_fee)
    await client.query(
      `INSERT INTO host_payouts (booking_id, host_id, amount, status)
       VALUES ($1, $2, $3, 'pending') ON CONFLICT (booking_id) DO NOTHING`,
      [id, booking.host_id, payout],
    )
    await recordAudit(client, {
      actor: { id: actor.id, role: actor.role },
      action: 'booking.checkout',
      entityType: 'booking',
      entityId: id,
      before: { status: booking.status },
      after: { status: 'completed', payout },
      req,
    })
    logger.info({ bookingId: id, payout }, 'booking completed')
    return { id: updated[0].id, status: 'completed', checkedOutAt: updated[0].checked_out_at, payout }
  })
}

/** POST /bookings/:id/pin - regenerate a forgotten PIN (owner only). */
export async function regeneratePin(id, userId) {
  const { rows } = await query('SELECT id, user_id, status FROM bookings WHERE id = $1', [id])
  const booking = rows[0]
  if (!booking) throw ApiError.notFound('Booking not found')
  if (String(booking.user_id) !== String(userId)) throw ApiError.forbidden('Not your booking')
  if (!['confirmed', 'checked_in'].includes(booking.status)) {
    throw ApiError.badRequest('PIN can only be regenerated for an active booking')
  }
  const pin = randomPin()
  await query('UPDATE bookings SET check_in_pin_hash = $2, pin_attempts = 0, updated_at = now() WHERE id = $1', [
    id,
    sha256(pin),
  ])
  return { id, pinCode: pin }
}

export function shapeBooking(row, { includePin = false } = {}) {
  return {
    id: row.id,
    status: row.status,
    code: row.code,
    plan: row.pricing_plan,
    start: row.start_time,
    end: row.end_time,
    hours: row.hours != null ? Number(row.hours) : null,
    pricing: {
      base: Number(row.base_amount),
      surgeMultiplier: Number(row.surge_multiplier),
      surgeAmount: Number(row.surge_amount),
      platformFee: Number(row.platform_fee),
      total: Number(row.amount),
      currency: env.currency,
    },
    vehicle: { number: row.vehicle_number, type: row.vehicle_type },
    notes: row.notes,
    pilgrimName: row.pilgrim_name ?? row.user_name,
    spot: {
      id: row.spot_id,
      title: row.spot_title,
      address: row.spot_address,
      lat: row.latitude != null ? Number(row.latitude) : null,
      lng: row.longitude != null ? Number(row.longitude) : null,
      zone: row.zone_name,
      zoneSlug: row.zone_slug,
      gateInstructions: row.gate_instructions,
      checkInFrom: row.check_in_from,
      checkOutBy: row.check_out_by,
    },
    host: { id: row.host_id, name: row.host_name, phone: row.host_phone ?? undefined },
    user: { id: row.user_id, name: row.user_name, phone: row.user_phone ?? undefined },
    checkIn: {
      checkedInAt: row.checked_in_at,
      checkedOutAt: row.checked_out_at,
      // The plaintext PIN exists only in the create/regenerate response; the
      // check-in screen is fed by the QR token or the one-time reveal.
      qrToken: includePin ? row.qr_token : undefined,
    },
    cancellation: row.cancelled_at
      ? { at: row.cancelled_at, reason: row.cancellation_reason, refund: Number(row.refund_amount ?? 0) }
      : null,
    hasReview: row.has_review ?? false,
    createdAt: row.created_at,
  }
}

export { BOOKING_COLUMNS }
