import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData, sendPage } from '../lib/http.js'
import { isoDateTime, pagination, uuid, validate, vehicleType } from '../lib/validate.js'
import { findNearby, getReviews, getSpot } from '../services/spots.service.js'

const router = Router()

const window = {
  start: isoDateTime.optional(),
  end: isoDateTime.optional(),
}

const nearbyQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius_km: z.coerce.number().min(0.1).max(50).optional(),
    vehicle_type: vehicleType.optional(),
    date_range: z.string().optional().describe('JSON {"start":"...","end":"..."} alternative to start/end'),
    start: isoDateTime.optional(),
    end: isoDateTime.optional(),
    zone: z.string().optional(),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().min(0).optional(),
    instant_book: z.coerce.boolean().optional(),
    features: z.string().optional().describe('Comma separated feature ids'),
    sort: z.enum(['distance', 'price', 'rating', 'availability']).default('distance'),
    ...pagination.shape,
  })
  .refine((value) => Boolean(value.start) === Boolean(value.end), {
    message: 'start and end must be provided together',
    path: ['start'],
  })

/**
 * @openapi
 * /spots/nearby:
 *   get:
 *     summary: Find bookable parking near a coordinate
 *     description: >
 *       Geospatial search sorted by distance. Uses PostGIS ST_DWithin/ST_Distance when the
 *       extension is installed and an inline haversine fallback otherwise. When `start`/`end`
 *       are supplied, only spots with a free bay of the requested vehicle type for that exact
 *       window are returned.
 *     tags: [Discovery]
 *     parameters:
 *       - { in: query, name: lat, required: true, schema: { type: number, example: 19.9975 } }
 *       - { in: query, name: lng, required: true, schema: { type: number, example: 73.3118 } }
 *       - { in: query, name: radius_km, schema: { type: number, default: 8 } }
 *       - { in: query, name: vehicle_type, schema: { type: string, enum: [2w, car, bus] } }
 *       - { in: query, name: start, schema: { type: string, format: date-time } }
 *       - { in: query, name: end, schema: { type: string, format: date-time } }
 *       - { in: query, name: zone, schema: { type: string, example: ramkund } }
 *       - { in: query, name: sort, schema: { type: string, enum: [distance, price, rating, availability] } }
 *     responses:
 *       200:
 *         description: Matching spots, nearest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Spot' }
 *                 meta: { $ref: '#/components/schemas/PageMeta' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.get(
  '/nearby',
  validate({ query: nearbyQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query
    let startISO = q.start
    let endISO = q.end
    if (q.date_range) {
      try {
        const parsed = JSON.parse(q.date_range)
        startISO = parsed.start
        endISO = parsed.end
      } catch {
        return sendPage(res, { items: [], page: 1, pageSize: q.pageSize, total: 0 })
      }
    }

    const { items, total } = await findNearby({
      lat: q.lat,
      lng: q.lng,
      radiusKm: q.radius_km,
      vehicleType: q.vehicle_type,
      startISO,
      endISO,
      zone: q.zone,
      minPrice: q.min_price,
      maxPrice: q.max_price,
      instantBook: q.instant_book,
      features: q.features ? q.features.split(',').map((f) => f.trim()).filter(Boolean) : undefined,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    })

    return sendPage(res, { items, page: q.page, pageSize: q.pageSize, total })
  }),
)

/**
 * @openapi
 * /spots/{id}:
 *   get:
 *     summary: Spot detail with live availability
 *     tags: [Discovery]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: start, schema: { type: string, format: date-time } }
 *       - { in: query, name: end, schema: { type: string, format: date-time } }
 *     responses:
 *       200:
 *         description: Spot
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { data: { $ref: '#/components/schemas/Spot' } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/:id',
  validate({
    params: z.object({ id: uuid }),
    query: z.object({ ...window, vehicle_type: vehicleType.optional() }),
  }),
  asyncHandler(async (req, res) => {
    const spot = await getSpot(req.params.id, {
      withAvailabilityFor: req.query.start ? { startISO: req.query.start, endISO: req.query.end } : null,
    })
    sendData(res, spot)
  }),
)

/**
 * @openapi
 * /spots/{id}/availability:
 *   get:
 *     summary: Free bays per vehicle type for a time window
 *     tags: [Discovery]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: start, required: true, schema: { type: string, format: date-time } }
 *       - { in: query, name: end, required: true, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Availability map }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.get(
  '/:id/availability',
  validate({
    params: z.object({ id: uuid }),
    query: z.object({ start: isoDateTime, end: isoDateTime }).refine((v) => new Date(v.end) > new Date(v.start), {
      message: 'end must be after start',
      path: ['end'],
    }),
  }),
  asyncHandler(async (req, res) => {
    const spot = await getSpot(req.params.id, {
      withAvailabilityFor: { startISO: req.query.start, endISO: req.query.end },
    })
    sendData(res, { spotId: spot.id, start: req.query.start, end: req.query.end, ...spot.availability_by_type })
  }),
)

/**
 * @openapi
 * /spots/{id}/reviews:
 *   get:
 *     summary: Paginated reviews for a spot
 *     tags: [Discovery]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Reviews }
 */
router.get(
  '/:id/reviews',
  validate({ params: z.object({ id: uuid }), query: pagination }),
  asyncHandler(async (req, res) => {
    const { items, total } = await getReviews(req.params.id, { page: req.query.page, pageSize: req.query.pageSize })
    sendPage(res, { items, page: req.query.page, pageSize: req.query.pageSize, total })
  }),
)

export default router
