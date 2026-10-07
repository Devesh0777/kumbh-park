import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { safeEqual, sha256 } from '../lib/crypto.js'
import { recordAudit } from '../middleware/error.js'
import { createSpot, materialiseSlots, shapeSpot, SPOT_COLUMNS, hostFields } from './spots.service.js'
import { listHostBookings } from './bookings.service.js'

const HOST_SPOT_SELECT = `
  SELECT ${SPOT_COLUMNS}, ${hostFields},
         (s.photos->0) AS cover_photo,
         (SELECT json_build_object('id', z.id, 'name', z.name, 'slug', z.slug, 'mela_note', z.mela_note)
          FROM zones z WHERE z.id = s.zone_id) AS zone
  FROM parking_spots s
  JOIN zones z ON z.id = s.zone_id
  JOIN users u ON u.id = s.host_id`

/** GET /host/spots - the host's own listings, all statuses. */
export const listHostSpots = async (hostId) => {
  const { rows } = await query(
    `${HOST_SPOT_SELECT}
     WHERE s.host_id = $1
     ORDER BY s.created_at DESC`,
    [hostId],
  )
  return rows.map(shapeSpot)
}

export const getHostSpot = async (hostId, spotId) => {
  const { rows } = await query(`${HOST_SPOT_SELECT} WHERE s.host_id = $1 AND s.id = $2`, [hostId, spotId])
  if (!rows[0]) throw ApiError.notFound('Spot not found on your account')
  return shapeSpot(rows[0])
}

export const updateHostSpot = async (hostId, spotId, payload, req) => {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query('SELECT * FROM parking_spots WHERE id = $1 AND host_id = $2 FOR UPDATE', [
      spotId,
      hostId,
    ])
    const existing = existingRows[0]
    if (!existing) throw ApiError.notFound('Spot not found on your account')

    // Re-syncing is always safe: existing bay codes are left untouched, so a
    // capacity increase adds bays and a decrease keeps the already-booked ones.
    const capacityChanged =
      (payload.capacity?.['2w'] != null && payload.capacity['2w'] !== existing.capacity_2w) ||
      (payload.capacity?.car != null && payload.capacity.car !== existing.capacity_car) ||
      (payload.capacity?.bus != null && payload.capacity.bus !== existing.capacity_bus)
    let slotsCreated = 0
    if (capacityChanged && existing.status === 'verified') {
      slotsCreated = await materialiseSlots(client, spotId, {
        '2w': payload.capacity?.['2w'] ?? existing.capacity_2w,
        car: payload.capacity?.car ?? existing.capacity_car,
        bus: payload.capacity?.bus ?? existing.capacity_bus,
      })
    }

    const { rows } = await client.query(
      `UPDATE parking_spots SET
         title = COALESCE($3, title),
         description = COALESCE($4, description),
         address = COALESCE($5, address),
         landmark = COALESCE($6, landmark),
         latitude = COALESCE($7, latitude),
         longitude = COALESCE($8, longitude),
         capacity_2w = COALESCE($9, capacity_2w),
         capacity_car = COALESCE($10, capacity_car),
         capacity_bus = COALESCE($11, capacity_bus),
         price_per_hour = COALESCE($12, price_per_hour),
         price_per_day = COALESCE($13, price_per_day),
         availability_windows = COALESCE($14::jsonb, availability_windows),
         features = COALESCE($15::jsonb, features),
         surface = COALESCE($16, surface),
         clearance_m = COALESCE($17, clearance_m),
         gate_instructions = COALESCE($18, gate_instructions),
         check_in_from = COALESCE($19, check_in_from),
         check_out_by = COALESCE($20, check_out_by),
         photos = COALESCE($21::jsonb, photos),
         instant_book = COALESCE($22, instant_book),
         updated_at = now()
       WHERE id = $1 AND host_id = $2
       RETURNING *`,
      [
        spotId,
        hostId,
        payload.title ?? null,
        payload.description ?? null,
        payload.address ?? null,
        payload.landmark ?? null,
        payload.lat ?? null,
        payload.lng ?? null,
        payload.capacity?.['2w'] ?? null,
        payload.capacity?.car ?? null,
        payload.capacity?.bus ?? null,
        payload.pricePerHour ?? null,
        payload.pricePerDay ?? null,
        payload.availabilityWindows ? JSON.stringify(payload.availabilityWindows) : null,
        payload.features ? JSON.stringify(payload.features) : null,
        payload.surface ?? null,
        payload.clearanceM ?? null,
        payload.gateInstructions ?? null,
        payload.checkInFrom ?? null,
        payload.checkOutBy ?? null,
        payload.photos ? JSON.stringify(payload.photos) : null,
        payload.instantBook ?? null,
      ],
    )
    await recordAudit(client, {
      actor: { id: hostId, role: 'host' },
      action: 'spot.update',
      entityType: 'parking_spot',
      entityId: spotId,
      before: existing,
      after: { ...rows[0], slotsCreated },
      req,
    })
    return rows[0]
  })
}

/** POST /host/spots/:id/submit - send a draft to admin review. */
export const submitSpotForReview = async (hostId, spotId, req) => {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query(
      `SELECT id, status FROM parking_spots WHERE id = $1 AND host_id = $2 FOR UPDATE`,
      [spotId, hostId],
    )
    const existing = existingRows[0]
    if (!existing) throw ApiError.notFound('Spot not found on your account')
    if (!['draft', 'rejected'].includes(existing.status)) {
      throw ApiError.badRequest(`Cannot submit a spot that is already ${existing.status}`)
    }
    const { rows } = await client.query(
      `UPDATE parking_spots SET status = 'pending', updated_at = now() WHERE id = $1 RETURNING id, status`,
      [spotId],
    )
    await recordAudit(client, {
      actor: { id: hostId, role: 'host' },
      action: 'spot.submit',
      entityType: 'parking_spot',
      entityId: spotId,
      before: { status: existing.status },
      after: { status: 'pending' },
      req,
    })
    return rows[0]
  })
}

/** PATCH /host/spots/:id/availability - pause/resume and set manual bay blocks. */
export const setSpotAvailability = async (hostId, spotId, { isAccepting, blockedSlotIds }, req) => {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT id, status, is_accepting FROM parking_spots WHERE id = $1 AND host_id = $2 FOR UPDATE',
      [spotId, hostId],
    )
    if (!existingRows[0]) throw ApiError.notFound('Spot not found on your account')

    if (isAccepting != null) {
      await client.query('UPDATE parking_spots SET is_accepting = $2, updated_at = now() WHERE id = $1', [
        spotId,
        isAccepting,
      ])
    }
    let blocked = 0
    if (Array.isArray(blockedSlotIds) && blockedSlotIds.length) {
      const { rowCount } = await client.query(
        'UPDATE slots SET is_currently_available = false WHERE id = ANY($1::uuid[]) AND spot_id = $2',
        [blockedSlotIds, spotId],
      )
      blocked = rowCount
    }
    await recordAudit(client, {
      actor: { id: hostId, role: 'host' },
      action: 'spot.availability',
      entityType: 'parking_spot',
      entityId: spotId,
      after: { isAccepting, blockedSlots: blocked },
      req,
    })
    return { id: spotId, isAccepting: isAccepting ?? existingRows[0].is_accepting, blockedSlots: blocked }
  })
}

export const deleteHostSpot = async (hostId, spotId, req) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id, status FROM parking_spots WHERE id = $1 AND host_id = $2 FOR UPDATE', [
      spotId,
      hostId,
    ])
    const spot = rows[0]
    if (!spot) throw ApiError.notFound('Spot not found on your account')
    if (spot.status === 'verified') {
      const { rows: active } = await client.query(
        `SELECT count(*)::int AS count FROM bookings
         WHERE spot_id = $1 AND status IN ('confirmed', 'checked_in') AND end_time > now()`,
        [spotId],
      )
      if (active[0].count > 0) {
        throw ApiError.conflict('SPOT_HAS_BOOKINGS', 'Pause this spot instead of deleting while bookings are active')
      }
    }
    await client.query('DELETE FROM parking_spots WHERE id = $1', [spotId])
    await recordAudit(client, {
      actor: { id: hostId, role: 'host' },
      action: 'spot.delete',
      entityType: 'parking_spot',
      entityId: spotId,
      before: spot,
      req,
    })
    return { id: spotId, deleted: true }
  })
}

/** GET /host/earnings - payout summary + per-booking rows. */
export const getEarnings = async (hostId, { page = 1, pageSize = 20 } = {}) => {
  const { rows: summary } = await query(
    `SELECT
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'pending'), 0) AS pending,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS paid_out,
       count(*) FILTER (WHERE p.status = 'pending')::int AS pending_count
     FROM host_payouts p WHERE p.host_id = $1`,
    [hostId],
  )
  const { rows } = await query(
    `SELECT p.id, p.amount, p.status, p.paid_at, p.created_at,
            b.id AS booking_id, b.start_time, b.end_time, b.status AS booking_status,
            b.amount AS total_amount, b.platform_fee, b.vehicle_number,
            s.title AS spot_title
     FROM host_payouts p
     JOIN bookings b ON b.id = p.booking_id
     JOIN parking_spots s ON s.id = b.spot_id
     WHERE p.host_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [hostId, pageSize, (page - 1) * pageSize],
  )
  const { rows: gross } = await query(
    `SELECT COALESCE(SUM(b.amount - b.platform_fee), 0) AS lifetime
     FROM bookings b JOIN parking_spots s ON s.id = b.spot_id
     WHERE s.host_id = $1 AND b.status IN ('confirmed', 'checked_in', 'completed')`,
    [hostId],
  )
  return {
    summary: {
      lifetime: Number(gross[0].lifetime),
      pending: Number(summary[0].pending),
      paidOut: Number(summary[0].paid_out),
      pendingCount: summary[0].pending_count,
      currency: 'INR',
    },
    items: rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      amount: Number(row.amount),
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      booking: {
        start: row.start_time,
        end: row.end_time,
        status: row.booking_status,
        vehicleNumber: row.vehicle_number,
        gross: Number(row.total_amount),
        platformFee: Number(row.platform_fee),
        spotTitle: row.spot_title,
      },
    })),
  }
}

/** GET /host/dashboard - the single call the host home screen needs. */
export const getHostDashboard = async (hostId) => {
  const spots = await listHostSpots(hostId)
  const { rows: stats } = await query(
    `SELECT
       count(*) FILTER (WHERE b.status = 'confirmed' AND b.start_time::date = current_date)::int AS bookings_today,
       COALESCE(SUM(b.amount - b.platform_fee) FILTER (WHERE b.start_time::date = current_date), 0) AS earnings_today,
       count(*) FILTER (WHERE b.status = 'checked_in')::int AS checked_in_now,
       COALESCE(SUM(b.amount - b.platform_fee) FILTER (WHERE b.start_time >= date_trunc('month', now())), 0) AS earnings_month,
       count(*) FILTER (WHERE b.start_time >= date_trunc('month', now()) AND b.status IN ('confirmed','checked_in','completed'))::int AS bookings_month
     FROM bookings b JOIN parking_spots s ON s.id = b.spot_id
     WHERE s.host_id = $1`,
    [hostId],
  )
  const { items: today } = await listHostBookings(hostId, { scope: 'today', pageSize: 10 })
  return { stats: stats[0], spots, today }
}

/** POST /host/verify-pin - host enters the pilgrim's PIN to confirm arrival. */
export const verifyPinForHost = async (hostId, bookingId, pin, req) => {
  const { rows } = await query(
    `SELECT b.id, b.slot_id, b.user_id, b.check_in_pin_hash, b.status, s.host_id, s.title
     FROM bookings b JOIN parking_spots s ON s.id = b.spot_id
     WHERE b.id = $1`,
    [bookingId],
  )
  const booking = rows[0]
  if (!booking) throw ApiError.notFound('Booking not found')
  if (String(booking.host_id) !== String(hostId)) throw ApiError.forbidden('Not your spot')
  const ok = safeEqual(sha256(String(pin)), booking.check_in_pin_hash)
  if (!ok) {
    logger.warn({ bookingId, hostId }, 'host pin verification failed')
    throw ApiError.forbidden('Incorrect PIN')
  }
  return { bookingId, verified: true, slotId: booking.slot_id, spotTitle: booking.title, status: booking.status }
}

export { createSpot }
