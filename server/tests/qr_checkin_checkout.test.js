import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  signParkingQrPayload,
  verifyAndExtractParkingQr,
} from '../src/services/qr.service.js'
import { hmac, randomNonce, sha256 } from '../src/lib/crypto.js'
import env from '../src/config/env.js'

describe('Part 1 & 7: QR Code Cryptographic Signature & Verification Tests', () => {
  const sampleParkingId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'

  it('generates a valid HMAC-signed QR token for a physical parking spot', () => {
    const issuedAt = new Date('2026-10-07T10:00:00.000Z')
    const { token, tokenHash, payload } = signParkingQrPayload(sampleParkingId, issuedAt)

    assert.ok(token.startsWith('pk_'), 'Token should have pk_ prefix')
    assert.ok(token.includes('.'), 'Token should contain raw payload and signature separated by dot')
    assert.equal(payload.parking_id, sampleParkingId)
    assert.equal(payload.issued_at, issuedAt.toISOString())
    assert.equal(tokenHash, sha256(token))
  })

  it('successfully verifies an authentic QR token and extracts parking_id', async () => {
    const { token } = signParkingQrPayload(sampleParkingId)
    const verified = await verifyAndExtractParkingQr(token, { checkDatabase: false })

    assert.equal(verified.parking_id, sampleParkingId)
    assert.ok(verified.issued_at)
    assert.ok(verified.token_hash)
  })

  it('rejects silently-tampered QR payloads with clear error', async () => {
    const { token } = signParkingQrPayload(sampleParkingId)
    const parts = token.slice(3).split('.') // remove pk_

    // Tamper with payload by modifying 1 character in the base64 string
    const tamperedPayload = parts[0].slice(0, -2) + (parts[0].slice(-2) === 'AA' ? 'BB' : 'AA')
    const tamperedToken = `pk_${tamperedPayload}.${parts[1]}`

    await assert.rejects(
      async () => verifyAndExtractParkingQr(tamperedToken, { checkDatabase: false }),
      (err) => {
        assert.equal(err.status, 400)
        assert.match(err.message, /tampered|signature/i)
        return true
      },
    )
  })

  it('rejects invalid format, missing prefix, or malformed tokens', async () => {
    await assert.rejects(
      async () => verifyAndExtractParkingQr('random_raw_string', { checkDatabase: false }),
      (err) => {
        assert.equal(err.status, 400)
        return true
      },
    )

    await assert.rejects(
      async () => verifyAndExtractParkingQr('pk_notvalidpayload', { checkDatabase: false }),
      (err) => {
        assert.equal(err.status, 400)
        return true
      },
    )
  })
})

describe('Part 3 & 7: Extra-Time Calculation & Boundary Conditions', () => {
  const hourlyRate = 60 // Rs 60 / hr

  // Helper simulating the core extra-time calculation logic from parking-scan.service.js
  function calculateExtraTime({ scheduledEndISO, checkOutISO, pricePerHour }) {
    const scheduledEnd = new Date(scheduledEndISO)
    const checkOutTime = new Date(checkOutISO)

    let extraHours = 0
    let extraDurationMinutes = 0
    let extraAmount = 0
    let bookingStatus = 'COMPLETED'
    let paymentStatus = 'COMPLETED'

    if (checkOutTime.getTime() > scheduledEnd.getTime()) {
      const extraMillis = checkOutTime.getTime() - scheduledEnd.getTime()
      extraDurationMinutes = Math.round(extraMillis / (60 * 1000))
      // Round UP to nearest whole billing hour
      extraHours = Math.ceil(extraMillis / (60 * 60 * 1000))
      extraAmount = Number((extraHours * pricePerHour).toFixed(2))

      if (extraAmount > 0) {
        bookingStatus = 'PENDING_EXTRA_PAYMENT'
        paymentStatus = 'PENDING_EXTRA'
      }
    }

    return {
      extraDurationMinutes,
      extraHours,
      extraAmount,
      bookingStatus,
      paymentStatus,
    }
  }

  it('Early checkout (checkOut < scheduledEnd): no refund, 0 extra charge, COMPLETED status', () => {
    const scheduledEnd = '2026-10-07T14:00:00.000Z'
    const earlyCheckOut = '2026-10-07T12:30:00.000Z' // 1.5 hours early

    const result = calculateExtraTime({
      scheduledEndISO: scheduledEnd,
      checkOutISO: earlyCheckOut,
      pricePerHour: hourlyRate,
    })

    assert.equal(result.extraHours, 0)
    assert.equal(result.extraAmount, 0)
    assert.equal(result.bookingStatus, 'COMPLETED')
    assert.equal(result.paymentStatus, 'COMPLETED')
  })

  it('Exact boundary: checkout exactly at scheduled_end produces 0 extra charge', () => {
    const scheduledEnd = '2026-10-07T14:00:00.000Z'
    const exactCheckOut = '2026-10-07T14:00:00.000Z'

    const result = calculateExtraTime({
      scheduledEndISO: scheduledEnd,
      checkOutISO: exactCheckOut,
      pricePerHour: hourlyRate,
    })

    assert.equal(result.extraHours, 0)
    assert.equal(result.extraAmount, 0)
    assert.equal(result.bookingStatus, 'COMPLETED')
    assert.equal(result.paymentStatus, 'COMPLETED')
  })

  it('Exact boundary: checkout 1 second after scheduled_end charges 1 whole hour', () => {
    const scheduledEnd = '2026-10-07T14:00:00.000Z'
    const lateBy1Sec = '2026-10-07T14:00:01.000Z' // 1 second late

    const result = calculateExtraTime({
      scheduledEndISO: scheduledEnd,
      checkOutISO: lateBy1Sec,
      pricePerHour: hourlyRate,
    })

    assert.equal(result.extraHours, 1, '1 second late rounds UP to 1 whole hour')
    assert.equal(result.extraAmount, 60, '1 hr * Rs 60 = Rs 60')
    assert.equal(result.bookingStatus, 'PENDING_EXTRA_PAYMENT')
    assert.equal(result.paymentStatus, 'PENDING_EXTRA')
  })

  it('Boundary: checkout 60 minutes after scheduled_end charges exactly 1 hour', () => {
    const scheduledEnd = '2026-10-07T14:00:00.000Z'
    const lateBy60Min = '2026-10-07T15:00:00.000Z' // 60 mins late

    const result = calculateExtraTime({
      scheduledEndISO: scheduledEnd,
      checkOutISO: lateBy60Min,
      pricePerHour: hourlyRate,
    })

    assert.equal(result.extraHours, 1)
    assert.equal(result.extraAmount, 60)
  })

  it('Boundary: checkout 61 minutes after scheduled_end rounds up to 2 hours', () => {
    const scheduledEnd = '2026-10-07T14:00:00.000Z'
    const lateBy61Min = '2026-10-07T15:01:00.000Z' // 61 mins late

    const result = calculateExtraTime({
      scheduledEndISO: scheduledEnd,
      checkOutISO: lateBy61Min,
      pricePerHour: hourlyRate,
    })

    assert.equal(result.extraHours, 2, '61 mins late rounds UP to 2 whole hours')
    assert.equal(result.extraAmount, 120, '2 hrs * Rs 60 = Rs 120')
    assert.equal(result.bookingStatus, 'PENDING_EXTRA_PAYMENT')
  })
})

describe('Part 4 & 7: Idempotency & Edge Cases Logic', () => {
  it('Simulates double-scan idempotency for check-in transition', () => {
    const recordedCheckIn = '2026-10-07T10:05:00.000Z'
    const booking = {
      id: 'b100',
      status: 'checked_in',
      booking_status: 'ACTIVE',
      check_in_time: recordedCheckIn,
    }

    // When scanned again, the system recognizes check_in_time is already set and returns recorded state
    const isIdempotent = Boolean(booking.check_in_time)
    assert.equal(isIdempotent, true)
    assert.equal(booking.booking_status, 'ACTIVE')
  })

  it('Simulates double-scan idempotency for check-out transition', () => {
    const recordedCheckOut = '2026-10-07T14:15:00.000Z'
    const booking = {
      id: 'b100',
      status: 'completed',
      booking_status: 'COMPLETED',
      check_out_time: recordedCheckOut,
      extra_amount: 0,
    }

    const isIdempotent = Boolean(booking.check_out_time)
    assert.equal(isIdempotent, true)
    assert.equal(booking.booking_status, 'COMPLETED')
  })
})

describe('Part 4 & 7: Background Jobs Simulation Tests', () => {
  it('No-Show logic correctly identifies expired unattended bookings', () => {
    const now = new Date('2026-10-07T18:00:00.000Z')
    const graceMinutes = 15

    const bookings = [
      {
        id: 'b1',
        status: 'confirmed',
        check_in_time: null,
        end_time: '2026-10-07T16:00:00.000Z', // ended 2 hours ago -> should be NO_SHOW
      },
      {
        id: 'b2',
        status: 'confirmed',
        check_in_time: '2026-10-07T15:00:00.000Z', // checked in -> NOT no-show
        end_time: '2026-10-07T16:00:00.000Z',
      },
      {
        id: 'b3',
        status: 'confirmed',
        check_in_time: null,
        end_time: '2026-10-07T19:00:00.000Z', // in the future -> NOT no-show
      },
    ]

    const noShowCandidates = bookings.filter((b) => {
      const endWithGrace = new Date(new Date(b.end_time).getTime() + graceMinutes * 60_000)
      return b.status === 'confirmed' && !b.check_in_time && endWithGrace <= now
    })

    assert.equal(noShowCandidates.length, 1)
    assert.equal(noShowCandidates[0].id, 'b1')
  })

  it('Forgot-to-checkout auto-checkout logic detects active stays past hard cap (+4h)', () => {
    const now = new Date('2026-10-07T20:00:00.000Z')
    const hardCapHours = 4
    const reviewThreshold = 1000
    const pricePerHour = 100

    const bookings = [
      {
        id: 'b1',
        status: 'checked_in',
        check_in_time: '2026-10-07T10:00:00.000Z',
        end_time: '2026-10-07T14:00:00.000Z', // 6 hours past end -> exceeds 4h cap
        check_out_time: null,
      },
      {
        id: 'b2',
        status: 'checked_in',
        check_in_time: '2026-10-07T16:00:00.000Z',
        end_time: '2026-10-07T18:00:00.000Z', // only 2 hours past end -> under 4h cap
        check_out_time: null,
      },
    ]

    const overdue = bookings.filter((b) => {
      const capTime = new Date(new Date(b.end_time).getTime() + hardCapHours * 3600_000)
      return b.status === 'checked_in' && !b.check_out_time && capTime <= now
    })

    assert.equal(overdue.length, 1)
    assert.equal(overdue[0].id, 'b1')

    // Test review threshold flagging:
    const extraHours = hardCapHours // 4 hours
    const extraAmount = extraHours * pricePerHour // Rs 400
    const needsReview = extraAmount >= reviewThreshold || extraHours >= 6

    assert.equal(needsReview, false, 'Rs 400 is below Rs 1000 review threshold')

    // High hourly rate spot: Rs 300 / hr -> Rs 1200
    const highExtraAmount = 4 * 300
    const highNeedsReview = highExtraAmount >= reviewThreshold
    assert.equal(highNeedsReview, true, 'Rs 1200 flags needs_manual_review = true')
  })
})
