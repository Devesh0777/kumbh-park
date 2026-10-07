import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData } from '../lib/http.js'
import { uuid, validate } from '../lib/validate.js'
import { authenticate } from '../middleware/auth.js'
import {
  getPendingExtraBookings,
  processParkingScan,
  verifyAndPayExtra,
} from '../services/parking-scan.service.js'
import {
  getOrCreateSpotQrToken,
  regenerateSpotQrToken,
  renderQrCodeImage,
} from '../services/qr.service.js'
import { runForgotToCheckoutJob, runNoShowJob } from '../jobs/parking-jobs.js'
import { query } from '../config/db.js'
import { ApiError } from '../lib/errors.js'

const router = Router()

/**
 * @openapi
 * /parking/scan:
 *   post:
 *     summary: Scan physical parking QR code for Check-in or Check-out
 *     description: >
 *       Single unified scan endpoint. The backend verifies the HMAC signature of the
 *       static physical QR code, checks the user's booking state for that parking spot,
 *       and executes either Check-in (CONFIRMED -> ACTIVE) or Check-out (ACTIVE -> COMPLETED / PENDING_EXTRA_PAYMENT).
 *     tags: [Parking Scan]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qr_token: { type: string, description: "HMAC signed token read from physical QR" }
 *               location_code: { type: string, description: "Manual fallback code if camera is unavailable" }
 *               spot_id: { type: string, format: uuid, description: "Direct spot ID" }
 *     responses:
 *       200:
 *         description: Check-in or Check-out confirmation with breakdown
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post(
  '/scan',
  authenticate,
  validate({
    body: z.object({
      qr_token: z.string().optional(),
      location_code: z.string().optional(),
      spot_id: uuid.optional(),
      user_id: uuid.optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const userId = req.body.user_id || req.user.id
    const result = await processParkingScan({
      qrToken: req.body.qr_token,
      locationCode: req.body.location_code,
      spotId: req.body.spot_id,
      userId,
      actor: req.user,
      req,
    })
    sendData(res, result)
  }),
)

/**
 * @openapi
 * /parking/pay-extra:
 *   post:
 *     summary: Settle pending extra payment for late check-out
 *     tags: [Parking Scan]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [booking_id]
 *             properties:
 *               booking_id: { type: string, format: uuid }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200: { description: Extra payment verified, booking completed }
 */
router.post(
  '/pay-extra',
  authenticate,
  validate({
    body: z.object({
      booking_id: uuid,
      razorpay_payment_id: z.string().optional(),
      razorpay_signature: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await verifyAndPayExtra({
      bookingId: req.body.booking_id,
      userId: req.user.id,
      razorpayPaymentId: req.body.razorpay_payment_id,
      razorpaySignature: req.body.razorpay_signature,
    })
    sendData(res, result)
  }),
)

/**
 * @openapi
 * /parking/extra-pending:
 *   get:
 *     summary: Get all bookings with pending extra payments for the current user
 *     tags: [Parking Scan]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of pending extra bookings with Razorpay order details }
 */
router.get(
  '/extra-pending',
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await getPendingExtraBookings(req.user.id)
    sendData(res, items)
  }),
)

/**
 * @openapi
 * /parking/{id}/qr:
 *   get:
 *     summary: Get printable static physical QR token and images for a parking spot
 *     tags: [Parking Spot QR]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: QR token, PNG Data URL, and SVG markup }
 */
router.get(
  '/:id/qr',
  validate({ params: z.object({ id: uuid }) }),
  asyncHandler(async (req, res) => {
    const spotId = req.params.id
    const { rows } = await query(
      `SELECT id, title, address, host_id FROM parking_spots WHERE id = $1`,
      [spotId],
    )
    if (!rows.length) throw ApiError.notFound('Parking spot not found')

    const { qrToken, tokenHash, issuedAt } = await getOrCreateSpotQrToken(spotId, {
      createdBy: req.user?.id,
    })

    const pngDataUrl = await renderQrCodeImage(qrToken, { format: 'png_data_url', width: 450 })
    const svg = await renderQrCodeImage(qrToken, { format: 'svg', width: 450 })

    sendData(res, {
      spotId,
      title: rows[0].title,
      address: rows[0].address,
      qrToken,
      tokenHash,
      issuedAt,
      pngDataUrl,
      svg,
    })
  }),
)

/**
 * @openapi
 * /parking/{id}/qr/regenerate:
 *   post:
 *     summary: Invalidate current QR code and reissue a new signed static QR token
 *     description: >
 *       Invalidates all previous physical printed QR codes for this spot immediately.
 *       Old tokens will stop working on scan right away.
 *     tags: [Parking Spot QR]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Reissued QR token and updated printable images }
 */
router.post(
  '/:id/qr/regenerate',
  authenticate,
  validate({
    params: z.object({ id: uuid }),
    body: z.object({ reason: z.string().max(200).optional() }).optional(),
  }),
  asyncHandler(async (req, res) => {
    const spotId = req.params.id
    const { rows } = await query(`SELECT host_id, title FROM parking_spots WHERE id = $1`, [spotId])
    if (!rows.length) throw ApiError.notFound('Parking spot not found')

    const isHost = req.user && String(req.user.id) === String(rows[0].host_id)
    const isAdmin = req.user?.role === 'admin'
    if (!isHost && !isAdmin) {
      throw ApiError.forbidden('Only the host or an admin can regenerate this spot QR code')
    }

    const reissued = await regenerateSpotQrToken(spotId, {
      createdBy: req.user.id,
      reason: req.body?.reason ?? 'Owner requested new QR code',
    })

    const pngDataUrl = await renderQrCodeImage(reissued.qrToken, { format: 'png_data_url', width: 450 })
    const svg = await renderQrCodeImage(reissued.qrToken, { format: 'svg', width: 450 })

    sendData(res, {
      ...reissued,
      pngDataUrl,
      svg,
    })
  }),
)

/**
 * Manual trigger endpoints for background jobs (testing & admin ops)
 */
router.post(
  '/jobs/no-show',
  asyncHandler(async (req, res) => {
    const graceMinutes = req.body?.graceMinutes ? Number(req.body.graceMinutes) : 15
    const result = await runNoShowJob({ graceMinutes })
    sendData(res, result)
  }),
)

router.post(
  '/jobs/forgot-checkout',
  asyncHandler(async (req, res) => {
    const hardCapHours = req.body?.hardCapHours ? Number(req.body.hardCapHours) : 4
    const reviewThresholdAmount = req.body?.reviewThresholdAmount ? Number(req.body.reviewThresholdAmount) : 1000
    const result = await runForgotToCheckoutJob({ hardCapHours, reviewThresholdAmount })
    sendData(res, result)
  }),
)

export default router
