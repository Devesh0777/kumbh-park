import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData, sendPage } from '../lib/http.js'
import { isoDateTime, pagination, uuid, validate, vehicleNumber, vehicleType } from '../lib/validate.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import {
  buildQrToken,
  cancelBooking,
  checkIn,
  checkOut,
  createBooking,
  getBookingById,
  listUserBookings,
  quoteBooking,
  regeneratePin,
} from '../services/bookings.service.js'

const router = Router()
router.use(authenticate)

const idParam = z.object({ id: uuid })
const window = { start: isoDateTime, end: isoDateTime }

const windowSchema = z.object(window).refine((v) => new Date(v.end) > new Date(v.start), {
  message: 'end must be after start',
  path: ['end'],
})

/**
 * @openapi
 * /bookings/quote:
 *   post:
 *     summary: Price a booking without creating it
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [spotId, start, end]
 *             properties:
 *               spotId: { type: string, format: uuid }
 *               start: { type: string, format: date-time }
 *               end: { type: string, format: date-time }
 *               vehicleType: { type: string, enum: [2w, car, bus] }
 *               plan: { type: string, enum: [hourly, daily] }
 *     responses:
 *       200:
 *         description: Quote with surge breakdown and free bay count
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  '/quote',
  validate({
    body: z.object({
      spotId: uuid,
      start: isoDateTime,
      end: isoDateTime,
      vehicleType: vehicleType.default('car'),
      plan: z.enum(['hourly', 'daily']).default('hourly'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { start, end, ...rest } = req.body
    sendData(res, await quoteBooking({ ...rest, startISO: start, endISO: end }))
  }),
)

/**
 * @openapi
 * /bookings:
 *   post:
 *     summary: Create a booking (atomically claims one free bay)
 *     description: >
 *       Uses `SELECT ... FOR UPDATE SKIP LOCKED` to claim a bay, so two concurrent
 *       requests can never be assigned the same slot. A database exclusion constraint
 *       on (slot_id, time_window) is the final guard and surfaces as `409 SLOT_TAKEN`.
 *       The response contains the one-time `pinCode` used for manual check-in.
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [spotId, start, end, vehicleNumber]
 *             properties:
 *               spotId: { type: string, format: uuid }
 *               start: { type: string, format: date-time }
 *               end: { type: string, format: date-time }
 *               vehicleNumber: { type: string, example: MH15AB1234 }
 *               vehicleType: { type: string, enum: [2w, car, bus] }
 *               plan: { type: string, enum: [hourly, daily] }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Booking confirmed, includes one-time pinCode
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       409:
 *         description: No bay free, or the bay was taken mid-request (SLOT_TAKEN / NO_BAYS_FREE)
 */
router.post(
  '/',
  validate({
    body: z.object({
      spotId: uuid,
      start: isoDateTime,
      end: isoDateTime,
      vehicleNumber,
      vehicleType: vehicleType.default('car'),
      plan: z.enum(['hourly', 'daily']).default('hourly'),
      notes: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    // The wire contract is start/end (see the schema above); the service layer
    // speaks startISO/endISO. Without this mapping both quote and create always
    // failed assertBookableWindow with "Invalid start or end time".
    const { start, end, ...rest } = req.body
    const booking = await createBooking(req.user.id, { ...rest, startISO: start, endISO: end }, req)
    res.status(201).json({ data: { ...booking, qrToken: buildQrToken(booking) } })
  }),
)

/**
 * @openapi
 * /bookings:
 *   get:
 *     summary: List the signed-in pilgrim's bookings
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: scope, schema: { type: string, enum: [upcoming, past, active, cancelled] } }
 *     responses:
 *       200: { description: Bookings }
 */
router.get(
  '/',
  validate({
    query: z.object({ scope: z.enum(['upcoming', 'past', 'active', 'cancelled']).default('upcoming'), ...pagination.shape }),
  }),
  asyncHandler(async (req, res) => {
    const { items, total } = await listUserBookings(req.user.id, req.query)
    sendPage(res, { items, page: req.query.page, pageSize: req.query.pageSize, total })
  }),
)

/**
 * @openapi
 * /bookings/{id}:
 *   get:
 *     summary: Booking detail (owner or the spot's host)
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Booking }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => sendData(res, await getBookingById(req.params.id, req.user.id, { asHost: true }))),
)

/**
 * @openapi
 * /bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking
 *     description: Refund policy - full up to 2h before start, 50% within 2h, none after start.
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { reason: { type: string } } }
 *     responses:
 *       200: { description: Cancelled with refund amount }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  '/:id/cancel',
  validate({ params: idParam, body: z.object({ reason: z.string().max(300).optional() }) }),
  asyncHandler(async (req, res) => sendData(res, await cancelBooking(req.params.id, req.user.id, req.body.reason, req))),
)

/**
 * @openapi
 * /bookings/{id}/checkin:
 *   post:
 *     summary: Check a vehicle in with the QR token or the 6 digit PIN
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string, description: from the scanned QR code }
 *               pin: { type: string, example: "482913" }
 *     responses:
 *       200: { description: Checked in }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post(
  '/:id/checkin',
  validate({ params: idParam, body: z.object({ token: z.string().optional(), pin: z.string().regex(/^\d{6}$/).optional() }) }),
  asyncHandler(async (req, res) => sendData(res, await checkIn(req.params.id, { actor: req.user, ...req.body, req }))),
)

/**
 * @openapi
 * /bookings/{id}/checkout:
 *   post:
 *     summary: Check a vehicle out and queue the host payout (host or admin only)
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Completed with payout amount }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post(
  '/:id/checkout',
  validate({ params: idParam }),
  requireRole('host', 'admin'),
  asyncHandler(async (req, res) => sendData(res, await checkOut(req.params.id, { actor: req.user, req }))),
)

/**
 * @openapi
 * /bookings/{id}/pin:
 *   post:
 *     summary: Regenerate the check-in PIN (owner only)
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: New one-time PIN }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post(
  '/:id/pin',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => sendData(res, await regeneratePin(req.params.id, req.user.id))),
)

export default router
