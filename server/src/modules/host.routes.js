import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData, sendPage } from '../lib/http.js'
import { pagination, uuid, validate, zoneId } from '../lib/validate.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { listHostBookings } from '../services/bookings.service.js'
import {
  createSpot,
  deleteHostSpot,
  getEarnings,
  getHostDashboard,
  getHostSpot,
  listHostSpots,
  setSpotAvailability,
  submitSpotForReview,
  updateHostSpot,
  verifyPinForHost,
} from '../services/host.service.js'

const router = Router()
router.use(authenticate, requireRole('host'))

const idParam = z.object({ id: uuid })

const capacity = z.object({
  '2w': z.coerce.number().int().min(0).max(200).default(0),
  car: z.coerce.number().int().min(0).max(200).default(0),
  bus: z.coerce.number().int().min(0).max(50).default(0),
})

const spotBody = z.object({
  zoneId,
  title: z.string().min(4).max(120),
  description: z.string().max(2000).optional(),
  address: z.string().min(6).max(300),
  landmark: z.string().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  capacity,
  pricePerHour: z.coerce.number().min(1).max(10_000),
  pricePerDay: z.coerce.number().min(1).max(100_000),
  minBookingHours: z.coerce.number().min(0.5).max(24).default(1),
  maxBookingHours: z.coerce.number().min(1).max(720).default(24),
  availabilityWindows: z
    .array(
      z.object({
        days: z.array(z.number().int().min(0).max(6)),
        from: z.string().regex(/^\d{2}:\d{2}$/),
        to: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .optional(),
  features: z.array(z.string().max(40)).max(20).optional(),
  surface: z.string().max(40).optional(),
  clearanceM: z.coerce.number().min(0).max(20).optional(),
  gateInstructions: z.string().max(1000).optional(),
  checkInFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutBy: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  photos: z.array(z.string().url().or(z.string().startsWith('data:'))).max(12).optional(),
  instantBook: z.boolean().default(true),
  submit: z.boolean().default(false).describe('true sends the spot straight to admin review'),
})

/**
 * @openapi
 * /host/spots:
 *   post:
 *     summary: Create a parking listing
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [zoneId, title, address, lat, lng, pricePerHour, pricePerDay]
 *             properties:
 *               zoneId: { type: string, example: ramkund }
 *               title: { type: string }
 *               address: { type: string }
 *               lat: { type: number }
 *               lng: { type: number }
 *               pricePerHour: { type: number, example: 40 }
 *               pricePerDay: { type: number, example: 350 }
 *               capacity: { type: object, properties: { '2w': { type: integer }, car: { type: integer }, bus: { type: integer } } }
 *               submit: { type: boolean, default: false }
 *     responses:
 *       201: { description: Created as draft or pending }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  '/spots',
  validate({ body: spotBody }),
  asyncHandler(async (req, res) => {
    const created = await createSpot(req.user.id, req.body, req)
    // createSpot returns the raw `RETURNING *` row; re-read it so the 201 body
    // matches GET /host/spots/{id} (camelCase, plus zone/host/bays).
    const spot = await getHostSpot(req.user.id, created.id)
    res.status(201).json({ data: spot })
  }),
)

/**
 * @openapi
 * /host/spots:
 *   get:
 *     summary: List the host's own listings
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Spots in every status }
 */
router.get(
  '/spots',
  asyncHandler(async (req, res) => sendData(res, await listHostSpots(req.user.id))),
)

/**
 * @openapi
 * /host/spots/{id}:
 *   get:
 *     summary: One of the host's listings
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Spot }, 404: { $ref: '#/components/responses/NotFound' } }
 */
router.get(
  '/spots/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => sendData(res, await getHostSpot(req.user.id, req.params.id))),
)

/**
 * @openapi
 * /host/spots/{id}:
 *   patch:
 *     summary: Update a listing
 *     description: Editing a verified spot sends it back to `pending` for re-verification.
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, description: any subset of the create body }
 *     responses: { 200: { description: Updated }, 404: { $ref: '#/components/responses/NotFound' } }
 */
router.patch(
  '/spots/:id',
  validate({ params: idParam, body: spotBody.partial() }),
  asyncHandler(async (req, res) => sendData(res, await updateHostSpot(req.user.id, req.params.id, req.body, req))),
)

/**
 * @openapi
 * /host/spots/{id}/submit:
 *   post:
 *     summary: Submit a draft or rejected spot for admin verification
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Now pending }, 400: { $ref: '#/components/responses/BadRequest' } }
 */
router.post(
  '/spots/:id/submit',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => sendData(res, await submitSpotForReview(req.user.id, req.params.id, req))),
)

/**
 * @openapi
 * /host/spots/{id}/availability:
 *   patch:
 *     summary: Pause/resume bookings or block individual bays
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isAccepting: { type: boolean }
 *               blockedSlotIds: { type: array, items: { type: string, format: uuid } }
 *     responses: { 200: { description: Applied } }
 */
router.patch(
  '/spots/:id/availability',
  validate({
    params: idParam,
    body: z.object({
      isAccepting: z.boolean().optional(),
      blockedSlotIds: z.array(uuid).max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => sendData(res, await setSpotAvailability(req.user.id, req.params.id, req.body, req))),
)

/**
 * @openapi
 * /host/spots/{id}:
 *   delete:
 *     summary: Delete a listing (refused while active bookings exist)
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Deleted }
 *       409: { description: SPOT_HAS_BOOKINGS - pause it instead }
 */
router.delete(
  '/spots/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => sendData(res, await deleteHostSpot(req.user.id, req.params.id, req))),
)

/**
 * @openapi
 * /host/bookings:
 *   get:
 *     summary: Bookings across the host's spots
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: scope, schema: { type: string, enum: [today, upcoming, active, completed, all] } }
 *     responses: { 200: { description: Bookings } }
 */
router.get(
  '/bookings',
  validate({
    query: z.object({
      scope: z.enum(['today', 'upcoming', 'active', 'completed', 'all']).default('today'),
      ...pagination.shape,
    }),
  }),
  asyncHandler(async (req, res) => {
    const { items, total } = await listHostBookings(req.user.id, req.query)
    sendPage(res, { items, page: req.query.page, pageSize: req.query.pageSize, total })
  }),
)

/**
 * @openapi
 * /host/earnings:
 *   get:
 *     summary: Payout summary and history
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Earnings } }
 */
router.get(
  '/earnings',
  validate({ query: pagination }),
  asyncHandler(async (req, res) => sendData(res, await getEarnings(req.user.id, req.query))),
)

/**
 * @openapi
 * /host/dashboard:
 *   get:
 *     summary: Everything the host home screen needs in one call
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Stats, spots, today's bookings } }
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => sendData(res, await getHostDashboard(req.user.id))),
)

/**
 * @openapi
 * /host/verify-pin:
 *   post:
 *     summary: Verify a pilgrim's 6 digit PIN for one of your bookings
 *     tags: [Host]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, pin]
 *             properties:
 *               bookingId: { type: string, format: uuid }
 *               pin: { type: string, example: "482913" }
 *     responses: { 200: { description: Verified }, 403: { $ref: '#/components/responses/Forbidden' } }
 */
router.post(
  '/verify-pin',
  validate({ body: z.object({ bookingId: uuid, pin: z.string().regex(/^\d{6}$/) }) }),
  asyncHandler(async (req, res) =>
    sendData(res, await verifyPinForHost(req.user.id, req.body.bookingId, req.body.pin, req)),
  ),
)

export default router
