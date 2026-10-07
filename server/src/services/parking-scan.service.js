import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { randomNonce, sha256 } from '../lib/crypto.js'
import { verifyAndExtractParkingQr } from './qr.service.js'
import { recordAudit } from '../middleware/error.js'
import env from '../config/env.js'

/**
 * Process a QR code scan at a physical parking spot.
 *
 * Single endpoint handles both CHECK-IN and CHECK-OUT based on the user's
 * current booking state at that specific parking_id.
 *
 * @param {object} params
 * @param {string} [params.qrToken] - Scanned physical QR code token
 * @param {string} [params.locationCode] - Manual location code fallback
 * @param {string} [params.spotId] - Direct spot ID fallback for testing
 * @param {string} params.userId - Authenticated user ID (from JWT)
 * @param {object} [params.actor] - Authenticated user object
 * @param {object} [params.req] - Express request for audit logging
 */
export async function processParkingScan({ qrToken, locationCode, spotId, userId, actor, req }) {
  if (!userId) {
    throw ApiError.unauthorized('Authentication required to scan parking QR')
  }

  // 1. Verify QR signature or fallback location code
  let parkingId = spotId

  if (qrToken) {
    const verified = await verifyAndExtractParkingQr(qrToken)
    parkingId = verified.parking_id
  } else if (locationCode) {
    // Manual fallback when camera is unavailable / denied
    const { rows: spotRows } = await query(
      `SELECT id FROM parking_spots WHERE id::text = $1 OR lower(title) LIKE lower($2) LIMIT 1`,
      [locationCode, `%${locationCode}%`],
    )
    if (!spotRows.length) {
      throw ApiError.notFound('Parking spot location code not found')
    }
    parkingId = spotRows[0].id
  } else if (!spotId) {
    throw ApiError.badRequest('Provide either a scanned qr_token or a location_code')
  }

  // 2. Fetch Spot details
  const { rows: spotRows } = await query(
    `SELECT s.id, s.title, s.address, s.price_per_hour, s.price_per_day,
            s.gate_instructions, s.check_in_from, s.check_out_by,
            s.host_id, h.name AS host_name, h.phone AS host_phone
     FROM parking_spots s
     JOIN users h ON h.id = s.host_id
     WHERE s.id = $1`,
    [parkingId],
  )
  const spot = spotRows[0]
  if (!spot) {
    throw ApiError.notFound('Parking spot not found')
  }

  // 3. Look up user's bookings for this parking spot inside a transaction
  return withTransaction(async (client) => {
    // Priority A: Check if user has an ACTIVE / checked-in booking that hasn't checked out yet
    const { rows: activeRows } = await client.query(
      `SELECT b.*,
              COALESCE(b.booking_status, CASE WHEN b.status = 'checked_in' THEN 'ACTIVE' ELSE 'CONFIRMED' END) AS current_booking_status,
              COALESCE(b.check_in_time, b.checked_in_at) AS active_check_in_time,
              COALESCE(b.check_out_time, b.checked_out_at) AS active_check_out_time
       FROM bookings b
       WHERE b.spot_id = $1
         AND b.user_id = $2
         AND (b.status = 'checked_in' OR b.booking_status = 'ACTIVE' OR b.booking_status = 'PENDING_EXTRA_PAYMENT')
       ORDER BY b.start_time DESC
       FOR UPDATE OF b`,
      [parkingId, userId],
    )

    const activeBooking = activeRows[0]

    if (activeBooking) {
      // ---------------------------------------------------------------------
      // PART 2b & PART 3: CHECK-OUT FLOW
      // ---------------------------------------------------------------------
      const now = new Date()

      // IDEMPOTENCY CHECK: If already checked out within the last 60 seconds (double-tap / network retry)
      if (activeBooking.active_check_out_time) {
        logger.info({ bookingId: activeBooking.id, userId }, 'Scan check-out idempotency: returning existing checkout result')
        return formatCheckOutResponse({
          booking: activeBooking,
          spot,
          checkOutTime: new Date(activeBooking.active_check_out_time),
          isIdempotentReplay: true,
        })
      }

      const scheduledEnd = new Date(activeBooking.end_time)
      const scheduledStart = new Date(activeBooking.start_time)
      const checkInTime = new Date(activeBooking.active_check_in_time ?? activeBooking.start_time)
      const checkOutTime = now

      // Extra-time calculation:
      // Compare check_out_time to scheduled_end
      let extraHours = 0
      let extraDurationMinutes = 0
      let extraAmount = 0
      let newBookingStatus = 'COMPLETED'
      let newStatus = 'completed'
      let newPaymentStatus = 'COMPLETED'
      let razorpayOrder = null

      if (checkOutTime.getTime() > scheduledEnd.getTime()) {
        const extraMillis = checkOutTime.getTime() - scheduledEnd.getTime()
        extraDurationMinutes = Math.round(extraMillis / (60 * 1000))

        // Billing increment: Round UP to nearest whole hour to match hourly rate
        extraHours = Math.ceil(extraMillis / (60 * 60 * 1000))
        extraAmount = Number((extraHours * Number(spot.price_per_hour)).toFixed(2))

        if (extraAmount > 0) {
          newBookingStatus = 'PENDING_EXTRA_PAYMENT'
          // Slot is released immediately, but status marks pending extra
          newPaymentStatus = 'PENDING_EXTRA'

          // Trigger Razorpay Order for extra amount only (Razorpay Test Mode)
          const orderId = `order_test_${randomNonce(12)}`
          razorpayOrder = {
            id: orderId,
            amount: Math.round(extraAmount * 100), // in paise
            currency: env.currency ?? 'INR',
            key: 'rzp_test_parkshare_mvp',
            bookingId: activeBooking.id,
            description: `ParkShare Late Checkout Extra Charge (${extraHours} hr @ ₹${spot.price_per_hour}/hr)`,
            prefill: {
              name: actor?.name,
              phone: actor?.phone,
            },
          }
        }
      }

      // Update booking in database
      const totalAmount = Number((Number(activeBooking.amount) + extraAmount).toFixed(2))

      await client.query(
        `UPDATE bookings
         SET status = $1,
             booking_status = $2,
             payment_status = $3,
             checked_out_at = $4,
             check_out_time = $4,
             extra_amount = $5,
             extra_hours = $6,
             razorpay_extra_order_id = $7,
             updated_at = now()
         WHERE id = $8`,
        [
          newStatus,
          newBookingStatus,
          newPaymentStatus,
          checkOutTime,
          extraAmount,
          extraHours,
          razorpayOrder?.id ?? null,
          activeBooking.id,
        ],
      )

      // Queue host payout if completed immediately (or base payout)
      const basePlatformFee = Number(activeBooking.platform_fee ?? 0)
      const basePayout = Math.max(0, Number(activeBooking.amount) - basePlatformFee)

      await client.query(
        `INSERT INTO host_payouts (booking_id, host_id, amount, platform_fee, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (booking_id) DO NOTHING`,
        [activeBooking.id, spot.host_id, basePayout, basePlatformFee],
      )

      await recordAudit(client, {
        actor: { id: userId, role: actor?.role ?? 'pilgrim' },
        action: 'parking.scan.checkout',
        entityType: 'booking',
        entityId: activeBooking.id,
        before: { status: activeBooking.status, bookingStatus: activeBooking.current_booking_status },
        after: {
          status: newStatus,
          bookingStatus: newBookingStatus,
          extraHours,
          extraAmount,
          totalAmount,
        },
        req,
      })

      logger.info(
        { bookingId: activeBooking.id, extraHours, extraAmount, newBookingStatus },
        'QR Scan: Checkout processed successfully',
      )

      return formatCheckOutResponse({
        booking: {
          ...activeBooking,
          booking_status: newBookingStatus,
          payment_status: newPaymentStatus,
          extra_amount: extraAmount,
          extra_hours: extraHours,
        },
        spot,
        checkInTime,
        checkOutTime,
        scheduledStart,
        scheduledEnd,
        extraDurationMinutes,
        extraHours,
        extraAmount,
        totalAmount,
        razorpayOrder,
      })
    }

    // Priority B: Check for CONFIRMED booking for this user at this parking spot
    const { rows: confirmedRows } = await client.query(
      `SELECT b.*,
              COALESCE(b.booking_status, 'CONFIRMED') AS current_booking_status,
              COALESCE(b.check_in_time, b.checked_in_at) AS active_check_in_time
       FROM bookings b
       WHERE b.spot_id = $1
         AND b.user_id = $2
         AND b.status = 'confirmed'
         AND (b.booking_status IS NULL OR b.booking_status = 'CONFIRMED')
       ORDER BY b.start_time ASC
       FOR UPDATE OF b`,
      [parkingId, userId],
    )

    // Check for duplicate / overlapping bookings upstream defence (Part 4)
    const { rows: allConfirmedAtSpot } = await client.query(
      `SELECT b.id, b.user_id, b.slot_id, b.start_time, b.end_time
       FROM bookings b
       WHERE b.spot_id = $1
         AND b.status = 'confirmed'
         AND b.start_time <= now() + interval '2 hours'
         AND b.end_time >= now() - interval '2 hours'`,
      [parkingId],
    )

    const uniqueUsersWithConfirmed = new Set(allConfirmedAtSpot.map((r) => r.user_id))
    if (uniqueUsersWithConfirmed.size > 1) {
      // Check if slot overlaps across different users
      logger.warn(
        { spotId: parkingId, users: Array.from(uniqueUsersWithConfirmed) },
        'SECURITY_ANOMALY_OVERLAPPING_CONFIRMED_BOOKINGS: Multiple users have active confirmed bookings near now()',
      )
    }

    const candidateBooking = confirmedRows[0]

    if (candidateBooking) {
      // ---------------------------------------------------------------------
      // PART 2a & PART 4: CHECK-IN FLOW
      // ---------------------------------------------------------------------
      const now = new Date()
      const scheduledStart = new Date(candidateBooking.start_time)
      const scheduledEnd = new Date(candidateBooking.end_time)

      // IDEMPOTENCY CHECK: If already checked in in the last 60 seconds
      if (candidateBooking.active_check_in_time) {
        logger.info({ bookingId: candidateBooking.id, userId }, 'Scan check-in idempotency: returning existing check-in result')
        return formatCheckInResponse({
          booking: candidateBooking,
          spot,
          checkInTime: new Date(candidateBooking.active_check_in_time),
          isIdempotentReplay: true,
        })
      }

      // Check if scan is after scheduled_end (Booking expired)
      if (now.getTime() > scheduledEnd.getTime()) {
        throw ApiError.badRequest(
          `Your booking for this spot expired at ${scheduledEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please make a new reservation.`,
        )
      }

      /*
       * EARLY CHECK-IN POLICY (Part 4 Decision):
       * If a user scans before their scheduled_start:
       * Policy: Allow early check-in so pilgrims are not blocked at the physical gate,
       * but maintain upfront fixed pricing billed from scheduled_start (do NOT start the clock early).
       */
      const isEarlyCheckIn = now.getTime() < scheduledStart.getTime()
      if (isEarlyCheckIn) {
        logger.info(
          { bookingId: candidateBooking.id, now, scheduledStart },
          'Early check-in approved: billing maintained from scheduled_start',
        )
      }

      const checkInTime = now
      const newBookingStatus = 'ACTIVE'
      const newStatus = 'checked_in'

      await client.query(
        `UPDATE bookings
         SET status = $1,
             booking_status = $2,
             checked_in_at = $3,
             check_in_time = $3,
             updated_at = now()
         WHERE id = $4`,
        [newStatus, newBookingStatus, checkInTime, candidateBooking.id],
      )

      await recordAudit(client, {
        actor: { id: userId, role: actor?.role ?? 'pilgrim' },
        action: 'parking.scan.checkin',
        entityType: 'booking',
        entityId: candidateBooking.id,
        before: { status: candidateBooking.status, bookingStatus: 'CONFIRMED' },
        after: { status: newStatus, bookingStatus: newBookingStatus, checkInTime, isEarlyCheckIn },
        req,
      })

      logger.info({ bookingId: candidateBooking.id, checkInTime }, 'QR Scan: Check-in processed successfully')

      return formatCheckInResponse({
        booking: { ...candidateBooking, booking_status: newBookingStatus },
        spot,
        checkInTime,
        scheduledStart,
        scheduledEnd,
        isEarlyCheckIn,
      })
    }

    // -----------------------------------------------------------------------
    // PART 2c: NO MATCHING ACTIVE OR CONFIRMED BOOKING FOUND
    // Specific, user-readable rejection reasons
    // -----------------------------------------------------------------------
    const { rows: historyRows } = await client.query(
      `SELECT b.id, b.status, b.booking_status, b.start_time, b.end_time, b.checked_out_at
       FROM bookings b
       WHERE b.spot_id = $1 AND b.user_id = $2
       ORDER BY b.created_at DESC
       LIMIT 5`,
      [parkingId, userId],
    )

    if (historyRows.length === 0) {
      throw ApiError.badRequest(
        `No active booking found for you at "${spot.title}". Please verify your booked parking location or make a reservation first.`,
      )
    }

    const latest = historyRows[0]
    const latestStatus = latest.booking_status || latest.status

    if (latestStatus === 'completed' || latestStatus === 'COMPLETED') {
      throw ApiError.badRequest(
        `Your booking at "${spot.title}" was already completed and checked out at ${new Date(latest.checked_out_at ?? latest.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      )
    }

    if (latestStatus === 'cancelled' || latestStatus === 'CANCELLED') {
      throw ApiError.badRequest(`Your booking at "${spot.title}" was cancelled and is no longer valid.`)
    }

    if (latestStatus === 'NO_SHOW') {
      throw ApiError.badRequest(`Your booking at "${spot.title}" expired and was marked as No-Show.`)
    }

    const start = new Date(latest.start_time)
    if (start.getTime() > Date.now()) {
      throw ApiError.badRequest(
        `Your reservation at "${spot.title}" is scheduled for ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      )
    }

    throw ApiError.badRequest(`No valid active or upcoming booking found for this spot.`)
  })
}

/**
 * Format structured check-in response.
 */
function formatCheckInResponse({
  booking,
  spot,
  checkInTime,
  scheduledStart,
  scheduledEnd,
  isEarlyCheckIn = false,
  isIdempotentReplay = false,
}) {
  return {
    action: 'CHECK_IN',
    bookingId: booking.id,
    bookingCode: booking.code,
    bookingStatus: 'ACTIVE',
    checkInTime: checkInTime.toISOString(),
    scheduledStart: (scheduledStart ?? new Date(booking.start_time)).toISOString(),
    scheduledEnd: (scheduledEnd ?? new Date(booking.end_time)).toISOString(),
    isEarlyCheckIn,
    isIdempotentReplay,
    spot: {
      id: spot.id,
      title: spot.title,
      address: spot.address,
      gateInstructions: spot.gate_instructions ?? null,
      hostName: spot.host_name,
      hostPhone: spot.host_phone,
    },
    message: isEarlyCheckIn
      ? 'Checked in early! Your parking pass is active and billed from your scheduled start.'
      : 'Checked in successfully! Your parking spot is active.',
  }
}

/**
 * Format structured check-out response with complete price breakdown.
 */
function formatCheckOutResponse({
  booking,
  spot,
  checkInTime,
  checkOutTime,
  scheduledStart,
  scheduledEnd,
  extraDurationMinutes = 0,
  extraHours = 0,
  extraAmount = 0,
  totalAmount,
  razorpayOrder = null,
  isIdempotentReplay = false,
}) {
  const baseAmount = Number(booking.amount ?? booking.base_amount ?? 0)
  const finalTotal = totalAmount ?? Number((baseAmount + extraAmount).toFixed(2))
  const bookingStatus = booking.booking_status ?? (extraAmount > 0 ? 'PENDING_EXTRA_PAYMENT' : 'COMPLETED')
  const paymentStatus = booking.payment_status ?? (extraAmount > 0 ? 'PENDING_EXTRA' : 'COMPLETED')

  return {
    action: 'CHECK_OUT',
    bookingId: booking.id,
    bookingCode: booking.code,
    bookingStatus,
    paymentStatus,
    isIdempotentReplay,
    spot: {
      id: spot.id,
      title: spot.title,
      address: spot.address,
    },
    breakdown: {
      baseAmount,
      scheduledStart: (scheduledStart ?? new Date(booking.start_time)).toISOString(),
      scheduledEnd: (scheduledEnd ?? new Date(booking.end_time)).toISOString(),
      checkInTime: (checkInTime ?? new Date(booking.check_in_time ?? booking.start_time)).toISOString(),
      checkOutTime: checkOutTime.toISOString(),
      extraDurationMinutes,
      extraHours,
      hourlyRate: Number(spot.price_per_hour),
      extraAmount,
      totalAmount: finalTotal,
      currency: env.currency ?? 'INR',
      razorpayOrder,
    },
    message:
      extraAmount > 0
        ? `Checked out with ${extraHours} extra hour(s). Please complete the extra payment of ₹${extraAmount}.`
        : 'Checked out successfully! Thank you for using ParkShare.',
  }
}

/**
 * Verify and settle extra payment for late checkouts.
 */
export async function verifyAndPayExtra({ bookingId, userId, razorpayPaymentId, razorpaySignature }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT b.*, s.host_id, s.title AS spot_title
       FROM bookings b
       JOIN parking_spots s ON s.id = b.spot_id
       WHERE b.id = $1 AND b.user_id = $2
       FOR UPDATE OF b`,
      [bookingId, userId],
    )

    const booking = rows[0]
    if (!booking) throw ApiError.notFound('Booking not found')

    if (booking.booking_status === 'COMPLETED' && booking.payment_status === 'COMPLETED') {
      return {
        bookingId,
        bookingStatus: 'COMPLETED',
        paymentStatus: 'COMPLETED',
        message: 'Extra payment was already verified and completed.',
      }
    }

    if (booking.booking_status !== 'PENDING_EXTRA_PAYMENT' && booking.payment_status !== 'PENDING_EXTRA') {
      throw ApiError.badRequest('Booking has no pending extra payment')
    }

    // In Razorpay Test Mode, record payment ID
    const paymentId = razorpayPaymentId ?? `pay_test_${randomNonce(12)}`

    await client.query(
      `UPDATE bookings
       SET booking_status = 'COMPLETED',
           status = 'completed',
           payment_status = 'COMPLETED',
           razorpay_extra_payment_id = $1,
           updated_at = now()
       WHERE id = $2`,
      [paymentId, bookingId],
    )

    // Update host payout with the extra amount (minus platform fee)
    const extra = Number(booking.extra_amount ?? 0)
    const feePct = Number(env.platformFeePct ?? 12) / 100
    const extraFee = Number((extra * feePct).toFixed(2))
    const extraPayout = extra - extraFee

    await client.query(
      `UPDATE host_payouts
       SET amount = amount + $2,
           platform_fee = platform_fee + $3
       WHERE booking_id = $1`,
      [bookingId, extraPayout, extraFee],
    )

    logger.info({ bookingId, paymentId, extra }, 'Extra payment settled successfully')

    return {
      bookingId,
      bookingStatus: 'COMPLETED',
      paymentStatus: 'COMPLETED',
      amountPaid: Number(booking.amount) + extra,
      extraPaid: extra,
      paymentId,
      message: 'Payment received successfully. Booking is now complete!',
    }
  })
}

/**
 * List all bookings with pending extra payments for a user (Retry / Reminder mechanism).
 */
export async function getPendingExtraBookings(userId) {
  const { rows } = await query(
    `SELECT b.id, b.code, b.spot_id, b.start_time, b.end_time, b.check_in_time, b.check_out_time,
            b.amount, b.extra_amount, b.extra_hours, b.razorpay_extra_order_id,
            s.title AS spot_title, s.address AS spot_address, s.price_per_hour
     FROM bookings b
     JOIN parking_spots s ON s.id = b.spot_id
     WHERE b.user_id = $1
       AND (b.booking_status = 'PENDING_EXTRA_PAYMENT' OR b.payment_status = 'PENDING_EXTRA')
     ORDER BY b.updated_at DESC`,
    [userId],
  )

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    spotId: r.spot_id,
    spotTitle: r.spot_title,
    spotAddress: r.spot_address,
    scheduledStart: r.start_time,
    scheduledEnd: r.end_time,
    checkInTime: r.check_in_time,
    checkOutTime: r.check_out_time,
    baseAmount: Number(r.amount),
    extraAmount: Number(r.extra_amount),
    extraHours: Number(r.extra_hours),
    hourlyRate: Number(r.price_per_hour),
    totalAmount: Number(r.amount) + Number(r.extra_amount),
    orderId: r.razorpay_extra_order_id,
  }))
}
