import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData } from '../lib/http.js'
import { uuid, validate } from '../lib/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createReport, createReview } from '../services/reviews.service.js'

const router = Router()
router.use(authenticate)

/**
 * @openapi
 * /reviews:
 *   post:
 *     summary: Review a completed booking
 *     description: One review per booking, only after check-out, only by the pilgrim who booked.
 *     tags: [Reviews]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, rating]
 *             properties:
 *               bookingId: { type: string, format: uuid }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, max: 1000 }
 *     responses:
 *       201: { description: Review stored, spot rating recomputed }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       409: { description: ALREADY_REVIEWED }
 */
router.post(
  '/reviews',
  validate({
    body: z.object({
      bookingId: uuid,
      rating: z.coerce.number().int().min(1).max(5),
      comment: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const review = await createReview(req.user.id, req.body, req)
    res.status(201).json({ data: review })
  }),
)

/**
 * @openapi
 * /reports:
 *   post:
 *     summary: Report a problem with a spot or booking
 *     tags: [Reviews]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, category, description]
 *             properties:
 *               bookingId: { type: string, format: uuid }
 *               category: { type: string, enum: [blocked_gate, overcharge, unsafe, wrong_location, dirty, other] }
 *               description: { type: string, max: 1000 }
 *               photoUrl: { type: string }
 *     responses:
 *       201: { description: Report queued for admin }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  '/reports',
  validate({
    body: z.object({
      bookingId: uuid,
      category: z.enum(['blocked_gate', 'overcharge', 'unsafe', 'wrong_location', 'dirty', 'other']),
      description: z.string().min(5).max(1000),
      photoUrl: z.string().url().or(z.string().startsWith('data:')).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const report = await createReport(req.user.id, req.body, req)
    res.status(201).json({ data: report })
  }),
)

export default router
