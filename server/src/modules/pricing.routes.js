import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData } from '../lib/http.js'
import { isoDateTime, uuid, validate, zoneId } from '../lib/validate.js'
import { authenticate, requireRole, requireServiceKey } from '../middleware/auth.js'
import { deleteSurgeWindow, listSurgeWindows, quoteForZone, upsertSurgeWindow } from '../services/pricing.service.js'
import { upsertSetting } from '../services/settings.service.js'

const router = Router()

/**
 * @openapi
 * /pricing/surge:
 *   post:
 *     summary: Write a surge multiplier for a zone window
 *     description: >
 *       Service-to-service endpoint for the demand/ML service, authenticated with
 *       `X-Service-Key` rather than a user token. The same window is upserted, so retries
 *       are idempotent. Overlapping windows are allowed; the booking path applies the
 *       highest matching multiplier.
 *     tags: [Pricing]
 *     security: [{ serviceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [zoneId, windowStart, windowEnd, multiplier]
 *             properties:
 *               zoneId: { type: string, example: ramkund }
 *               windowStart: { type: string, format: date-time }
 *               windowEnd: { type: string, format: date-time }
 *               multiplier: { type: number, minimum: 1, maximum: 5, example: 1.5 }
 *               reason: { type: string, example: "Ramkund Shahi Snan expected" }
 *               modelVersion: { type: string, example: "demand-v3" }
 *     responses:
 *       201: { description: Surge window stored }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post(
  '/surge',
  requireServiceKey,
  validate({
    body: z.object({
      zoneId,
      windowStart: isoDateTime,
      windowEnd: isoDateTime,
      multiplier: z.coerce.number().min(1).max(5),
      reason: z.string().max(200).optional(),
      modelVersion: z.string().max(60).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    // Wire contract is windowStart/windowEnd; the service speaks startISO/endISO.
    const { windowStart, windowEnd, ...rest } = req.body
    const saved = await upsertSurgeWindow(null, { ...rest, startISO: windowStart, endISO: windowEnd }, req)
    res.status(201).json({ data: saved })
  }),
)

/**
 * @openapi
 * /pricing/surge:
 *   get:
 *     summary: List active surge windows
 *     tags: [Pricing]
 *     parameters:
 *       - { in: query, name: zoneId, schema: { type: string, example: ramkund } }
 *       - { in: query, name: activeOnly, schema: { type: boolean, default: true } }
 *     responses: { 200: { description: Surge windows } }
 */
router.get(
  '/surge',
  validate({ query: z.object({ zoneId: zoneId.optional(), activeOnly: z.coerce.boolean().default(true) }) }),
  asyncHandler(async (req, res) => sendData(res, await listSurgeWindows(req.query))),
)

/**
 * @openapi
 * /pricing/surge/{id}:
 *   delete:
 *     summary: Remove a surge window
 *     tags: [Pricing]
 *     security: [{ serviceKey: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Deleted }, 404: { $ref: '#/components/responses/NotFound' } }
 */
router.delete(
  '/surge/:id',
  requireServiceKey,
  validate({ params: z.object({ id: uuid }) }),
  asyncHandler(async (req, res) => sendData(res, await deleteSurgeWindow(null, req.params.id, req))),
)

/**
 * @openapi
 * /pricing/quote:
 *   get:
 *     summary: Zone level price preview including any active surge
 *     tags: [Pricing]
 *     parameters:
 *       - { in: query, name: zoneId, required: true, schema: { type: string, example: ramkund } }
 *       - { in: query, name: start, required: true, schema: { type: string, format: date-time } }
 *       - { in: query, name: end, required: true, schema: { type: string, format: date-time } }
 *       - { in: query, name: hours, schema: { type: number, default: 2 } }
 *     responses: { 200: { description: Quote with surge breakdown }, 400: { $ref: '#/components/responses/BadRequest' } }
 */
router.get(
  '/quote',
  validate({
    query: z
      .object({
        zoneId,
        start: isoDateTime,
        end: isoDateTime,
        hours: z.coerce.number().min(0.5).max(720).default(2),
        pricePerHour: z.coerce.number().min(0).default(40),
      })
      .refine((v) => new Date(v.end) > new Date(v.start), { message: 'end must be after start', path: ['end'] }),
  }),
  asyncHandler(async (req, res) => {
    const { start, end, ...rest } = req.query
    sendData(res, await quoteForZone({ ...rest, startISO: start, endISO: end }))
  }),
)

/**
 * @openapi
 * /pricing/config:
 *   patch:
 *     summary: Update platform fee and cancellation policy (admin)
 *     tags: [Pricing]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platformFeePct: { type: number, example: 10 }
 *               cancellationPolicy: { type: object, description: freeCancelHours, partialRefundPct }
 *     responses: { 200: { description: Updated }, 403: { $ref: '#/components/responses/Forbidden' } }
 */
router.patch(
  '/config',
  authenticate,
  requireRole('admin'),
  validate({
    body: z.object({
      platformFeePct: z.coerce.number().min(0).max(40).optional(),
      cancellationPolicy: z
        .object({
          freeCancelHours: z.coerce.number().min(0).max(168).optional(),
          partialRefundPct: z.coerce.number().min(0).max(100).optional(),
        })
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const updated = []
    if (req.body.platformFeePct != null) {
      updated.push(await upsertSetting('platform_fee_pct', req.body.platformFeePct, req))
    }
    if (req.body.cancellationPolicy != null) {
      updated.push(await upsertSetting('cancellation_policy', req.body.cancellationPolicy, req))
    }
    sendData(res, updated)
  }),
)

export default router
