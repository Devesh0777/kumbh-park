import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { getZone, listZones } from '../services/spots.service.js'

const router = Router()

/**
 * @openapi
 * /zones:
 *   get:
 *     summary: Predefined Kumbh Mela zones
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Zones with verified spot counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Zone' }
 */
router.get(
  '/',
  asyncHandler(async (req, res) => sendData(res, await listZones())),
)

/**
 * @openapi
 * /zones/{id}:
 *   get:
 *     summary: Zone detail by id or slug
 *     tags: [Discovery]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: ramkund } }
 *     responses:
 *       200: { description: Zone }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/:id',
  validate({ params: z.object({ id: z.string().min(2) }) }),
  asyncHandler(async (req, res) => sendData(res, await getZone(req.params.id))),
)

export default router
