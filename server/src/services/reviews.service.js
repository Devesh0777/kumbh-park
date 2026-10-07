import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { recordAudit } from '../middleware/error.js'

/**
 * A review must belong to a completed booking on that spot, and the booking's
 * owner is the only one who can leave it. The spot's rolling rating/count are
 * recomputed in the same transaction.
 */
export const createReview = async (userId, { bookingId, rating, comment }, req) => {
  return withTransaction(async (client) => {
    const { rows: bookingRows } = await client.query(
      `SELECT b.id, b.user_id, b.spot_id, b.status, s.title
       FROM bookings b JOIN parking_spots s ON s.id = b.spot_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId],
    )
    const booking = bookingRows[0]
    if (!booking) throw ApiError.notFound('Booking not found')
    if (String(booking.user_id) !== String(userId)) throw ApiError.forbidden('Not your booking')
    if (booking.status !== 'completed') {
      throw ApiError.badRequest('You can review only after the parking is complete')
    }

    const { rows: existing } = await client.query('SELECT id FROM reviews WHERE booking_id = $1', [bookingId])
    if (existing.length) throw ApiError.conflict('ALREADY_REVIEWED', 'You already reviewed this booking')

    const { rows } = await client.query(
      `INSERT INTO reviews (booking_id, spot_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, rating, comment, created_at`,
      [bookingId, booking.spot_id, userId, rating, comment ?? null],
    )

    const { rows: agg } = await client.query(
      'SELECT round(avg(rating)::numeric, 2) AS rating, count(*)::int AS review_count FROM reviews WHERE spot_id = $1',
      [booking.spot_id],
    )
    await client.query('UPDATE parking_spots SET rating = $2, review_count = $3 WHERE id = $1', [
      booking.spot_id,
      agg[0].rating,
      agg[0].review_count,
    ])

    await recordAudit(client, {
      actor: { id: userId, role: 'pilgrim' },
      action: 'review.create',
      entityType: 'review',
      entityId: rows[0].id,
      after: { spotId: booking.spot_id, rating },
      req,
    })
    return { ...rows[0], spotId: booking.spot_id, spotTitle: booking.title }
  })
}

/** POST /reports - a pilgrim flags a spot (blocked gate, overcharge, unsafe). */
export const createReport = async (userId, { bookingId, category, description, photoUrl }, req) => {
  const { rows: bookingRows } = await query('SELECT id, spot_id, user_id FROM bookings WHERE id = $1', [bookingId])
  const booking = bookingRows[0]
  if (!booking) throw ApiError.notFound('Booking not found')
  if (String(booking.user_id) !== String(userId)) throw ApiError.forbidden('Not your booking')

  const { rows } = await query(
    `INSERT INTO reports (user_id, booking_id, spot_id, category, description, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, category, description, photo_url, status, created_at`,
    [userId, bookingId, booking.spot_id, category, description, photoUrl ?? null],
  )
  await recordAudit(null, {
    actor: { id: userId, role: 'pilgrim' },
    action: 'report.create',
    entityType: 'report',
    entityId: rows[0].id,
    after: { spotId: booking.spot_id, category },
    req,
  })
  return { ...rows[0], spotId: booking.spot_id }
}
