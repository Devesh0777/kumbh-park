import { query, withTransaction } from '../config/db.js'
import { logger } from '../lib/logger.js'
import { randomNonce } from '../lib/crypto.js'
import env from '../config/env.js'

/**
 * Job 1: No-Show Background Job
 *
 * Scans for bookings where the user never checked in (`check_in_time IS NULL`)
 * and the scheduled_end has passed (with a configurable grace period).
 *
 * Marks them NO_SHOW, releases the slot, and leaves the booking as paid/non-refundable.
 *
 * @param {object} [options]
 * @param {number} [options.graceMinutes=15] - Grace period past scheduled_end before declaring NO_SHOW
 * @returns {Promise<{ processedCount: number, bookingIds: string[] }>}
 */
export async function runNoShowJob({ graceMinutes = 15 } = {}) {
  logger.info({ graceMinutes }, 'Running No-Show detection job...')

  return withTransaction(async (client) => {
    // Find all confirmed bookings that never checked in whose end_time + graceMinutes has elapsed
    const { rows: expiredBookings } = await client.query(
      `SELECT b.id, b.code, b.spot_id, b.user_id, b.start_time, b.end_time, b.amount, b.platform_fee,
              s.host_id, s.title AS spot_title
       FROM bookings b
       JOIN parking_spots s ON s.id = b.spot_id
       WHERE b.status = 'confirmed'
         AND (b.booking_status IS NULL OR b.booking_status = 'CONFIRMED')
         AND (b.check_in_time IS NULL AND b.checked_in_at IS NULL)
         AND b.end_time + ($1 || ' minutes')::interval <= now()
       FOR UPDATE OF b SKIP LOCKED`,
      [graceMinutes],
    )

    if (expiredBookings.length === 0) {
      logger.info('No-Show job complete: 0 bookings required update.')
      return { processedCount: 0, bookingIds: [] }
    }

    const bookingIds = expiredBookings.map((b) => b.id)

    for (const booking of expiredBookings) {
      // Mark as NO_SHOW (status cancelled with non-refundable reason)
      await client.query(
        `UPDATE bookings
         SET status = 'cancelled',
             booking_status = 'NO_SHOW',
             cancellation_reason = 'NO_SHOW_EXPIRED',
             refund_amount = 0,
             cancelled_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [booking.id],
      )

      // Host payout still queues because spot was reserved and locked upfront (per no-refund MVP policy)
      const basePlatformFee = Number(booking.platform_fee ?? 0)
      const hostEarnings = Math.max(0, Number(booking.amount) - basePlatformFee)

      await client.query(
        `INSERT INTO host_payouts (booking_id, host_id, amount, platform_fee, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (booking_id) DO NOTHING`,
        [booking.id, booking.host_id, hostEarnings, basePlatformFee],
      )

      logger.info(
        { bookingId: booking.id, code: booking.code, spot: booking.spot_title },
        'Booking marked as NO_SHOW (unattended stay expired)',
      )
    }

    logger.info({ processedCount: bookingIds.length }, 'No-Show job completed successfully')
    return { processedCount: bookingIds.length, bookingIds }
  })
}

/**
 * Job 2: Forgot-to-Checkout Auto-Checkout Job
 *
 * Scans for bookings that are currently ACTIVE / checked_in where the user
 * forgot to scan out and the time has exceeded a hard cap past scheduled_end (e.g. +4 hours).
 *
 * Automatically checks out the booking using the cap time, computes extra-time
 * billing, sets PENDING_EXTRA_PAYMENT, releases the slot, and flags unusually
 * large amounts for manual admin review.
 *
 * @param {object} [options]
 * @param {number} [options.hardCapHours=4] - Hours past scheduled_end before auto-checkout kicks in
 * @param {number} [options.reviewThresholdAmount=1000] - Extra amount threshold in INR that triggers manual review flag
 * @returns {Promise<{ processedCount: number, autoCheckedOutBookings: Array }>}
 */
export async function runForgotToCheckoutJob({ hardCapHours = 4, reviewThresholdAmount = 1000 } = {}) {
  logger.info({ hardCapHours, reviewThresholdAmount }, 'Running Forgot-to-Checkout Auto-Checkout job...')

  return withTransaction(async (client) => {
    // Find active bookings that have exceeded scheduled_end by hardCapHours
    const { rows: overdueBookings } = await client.query(
      `SELECT b.id, b.code, b.spot_id, b.user_id, b.start_time, b.end_time,
              COALESCE(b.check_in_time, b.checked_in_at) AS check_in_time,
              b.amount, b.platform_fee,
              s.host_id, s.title AS spot_title, s.price_per_hour
       FROM bookings b
       JOIN parking_spots s ON s.id = b.spot_id
       WHERE (b.status = 'checked_in' OR b.booking_status = 'ACTIVE')
         AND (b.check_out_time IS NULL AND b.checked_out_at IS NULL)
         AND b.end_time + ($1 || ' hours')::interval <= now()
       FOR UPDATE OF b SKIP LOCKED`,
      [hardCapHours],
    )

    if (overdueBookings.length === 0) {
      logger.info('Forgot-to-Checkout job complete: 0 bookings required auto-checkout.')
      return { processedCount: 0, autoCheckedOutBookings: [] }
    }

    const processed = []

    for (const booking of overdueBookings) {
      const scheduledEnd = new Date(booking.end_time)
      // Cap the checkout time at scheduled_end + hardCapHours
      const autoCheckOutTime = new Date(scheduledEnd.getTime() + hardCapHours * 3600_000)

      const extraHours = hardCapHours
      const extraAmount = Number((extraHours * Number(booking.price_per_hour)).toFixed(2))
      const needsReview = extraAmount >= reviewThresholdAmount || extraHours >= 6
      const reviewReason = needsReview ? `Auto-checkout overdue: ₹${extraAmount} exceeds review threshold` : null

      const orderId = `order_test_${randomNonce(12)}`

      await client.query(
        `UPDATE bookings
         SET status = 'checked_in',
             booking_status = 'PENDING_EXTRA_PAYMENT',
             payment_status = 'PENDING_EXTRA',
             check_out_time = $1,
             checked_out_at = $1,
             extra_amount = $2,
             extra_hours = $3,
             needs_manual_review = $4,
             manual_review_reason = $5,
             razorpay_extra_order_id = $6,
             updated_at = now()
         WHERE id = $7`,
        [autoCheckOutTime, extraAmount, extraHours, needsReview, reviewReason, orderId, booking.id],
      )

      // Record in audit log
      logger.warn(
        {
          bookingId: booking.id,
          code: booking.code,
          extraHours,
          extraAmount,
          needsReview,
        },
        'Booking automatically checked out due to user forgot-to-checkout cap',
      )

      processed.push({
        bookingId: booking.id,
        code: booking.code,
        spotTitle: booking.spot_title,
        autoCheckOutTime: autoCheckOutTime.toISOString(),
        extraHours,
        extraAmount,
        needsReview,
        orderId,
      })
    }

    logger.info({ processedCount: processed.length }, 'Forgot-to-Checkout job completed successfully')
    return { processedCount: processed.length, autoCheckedOutBookings: processed }
  })
}

/**
 * Helper to start periodic background job execution timers.
 */
export function startBackgroundJobs({ intervalMinutes = 5 } = {}) {
  const timer = setInterval(async () => {
    try {
      await runNoShowJob()
      await runForgotToCheckoutJob()
    } catch (err) {
      logger.error({ err: err.message }, 'Background parking jobs encountered error')
    }
  }, intervalMinutes * 60_000)

  // Do not hold Node event loop open if everything else has stopped
  if (timer.unref) timer.unref()
  return timer
}
