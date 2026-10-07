import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, sendData, sendPage } from '../lib/http.js'
import { pagination, uuid, validate, zoneId } from '../lib/validate.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import {
  decideSubmission,
  getAnalytics,
  getOccupancy,
  listAuditLogs,
  listIssues,
  listPayouts,
  listSubmissions,
  markPayoutPaid,
  resolveIssue,
  setUserSuspension,
} from '../services/admin.service.js'

const router = Router()
router.use(authenticate, requireRole('admin'))

/**
 * @openapi
 * /admin/spots/submissions:
 *   get:
 *     summary: Verification queue
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, verified, rejected], default: pending } }
 *     responses: { 200: { description: Submissions } }
 */
router.get(
  '/spots/submissions',
  validate({ query: z.object({ status: z.enum(['pending', 'verified', 'rejected']).default('pending'), ...pagination.shape }) }),
  asyncHandler(async (req, res) => {
    const { items, total } = await listSubmissions(req.query)
    sendPage(res, { items, page: req.query.page, pageSize: req.query.pageSize, total })
  }),
)

/**
 * @openapi
 * /admin/spots/{id}/verify:
 *   post:
 *     summary: Approve or reject a host submission
 *     description: Approving also marks the host account verified. A reason is required to reject.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approved, rejected] }
 *               notes: { type: string, description: required when rejecting }
 *     responses:
 *       200: { description: Decision recorded in the audit log }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  '/spots/:id/verify',
  validate({ params: z.object({ id: uuid }), body: z.object({ decision: z.enum(['approved', 'rejected']), notes: z.string().max(1000).optional() }) }),
  asyncHandler(async (req, res) => sendData(res, await decideSubmission(req.user.id, req.params.id, req.body, req))),
)

/**
 * @openapi
 * /admin/hosts/{id}/suspend:
 *   post:
 *     summary: Suspend or reinstate a user
 *     description: Suspension revokes every active refresh token immediately.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [suspended]
 *             properties:
 *               suspended: { type: boolean }
 *               reason: { type: string, required when suspended is true }
 *     responses: { 200: { description: Updated }, 400: { $ref: '#/components/responses/BadRequest' } }
 */
router.post(
  '/hosts/:id/suspend',
  validate({
    params: z.object({ id: uuid }),
    body: z.object({ suspended: z.boolean(), reason: z.string().max(500).optional() }),
  }),
  asyncHandler(async (req, res) => sendData(res, await setUserSuspension(req.user.id, req.params.id, req.body, req))),
)

/**
 * @openapi
 * /admin/occupancy:
 *   get:
 *     summary: Live occupancy per zone
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: zone, schema: { type: string, example: ramkund } }]
 *     responses: { 200: { description: Occupancy board } }
 */
router.get(
  '/occupancy',
  validate({ query: z.object({ zone: zoneId.optional() }) }),
  asyncHandler(async (req, res) => sendData(res, await getOccupancy(req.query))),
)

/**
 * @openapi
 * /admin/issues:
 *   get:
 *     summary: Reported issues
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: status, schema: { type: string, enum: [open, resolved, all], default: open } }]
 *     responses: { 200: { description: Issues } }
 */
router.get(
  '/issues',
  validate({ query: z.object({ status: z.enum(['open', 'resolved', 'all']).default('open'), ...pagination.shape }) }),
  asyncHandler(async (req, res) => {
    const { items, total } = await listIssues(req.query)
    sendPage(res, { items, page: req.query.page, pageSize: req.query.pageSize, total })
  }),
)

/**
 * @openapi
 * /admin/issues/{id}/resolve:
 *   post:
 *     summary: Resolve an issue
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { resolution: { type: string } } }
 *     responses: { 200: { description: Resolved }, 400: { $ref: '#/components/responses/BadRequest' } }
 */
router.post(
  '/issues/:id/resolve',
  validate({ params: z.object({ id: uuid }), body: z.object({ resolution: z.string().max(1000).optional() }) }),
  asyncHandler(async (req, res) => sendData(res, await resolveIssue(req.user.id, req.params.id, req.body, req))),
)

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     summary: Headline metrics plus a 14 day booking/revenue trend
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Analytics } }
 */
router.get(
  '/analytics',
  asyncHandler(async (req, res) => sendData(res, await getAnalytics())),
)

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     summary: Immutable audit trail
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: entityType, schema: { type: string, example: parking_spot } }
 *       - { in: query, name: entityId, schema: { type: string, format: uuid } }
 *       - { in: query, name: actorId, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Audit entries, newest first } }
 */
router.get(
  '/audit-logs',
  validate({
    query: z.object({
      entityType: z.string().max(40).optional(),
      entityId: z.string().max(64).optional(),
      actorId: uuid.optional(),
      ...pagination.shape,
    }),
  }),
  asyncHandler(async (req, res) => sendData(res, await listAuditLogs(req.query))),
)

/**
 * @openapi
 * /admin/payouts:
 *   get:
 *     summary: Host payout queue
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: status, schema: { type: string, enum: [pending, paid, all] } }]
 *     responses: { 200: { description: Payouts } }
 */
router.get(
  '/payouts',
  validate({ query: z.object({ status: z.enum(['pending', 'paid', 'all']).default('pending') }) }),
  asyncHandler(async (req, res) => sendData(res, await listPayouts(req.query))),
)

/**
 * @openapi
 * /admin/payouts/{id}/paid:
 *   post:
 *     summary: Mark a payout as settled outside the system (UPI transfer)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Marked paid }, 400: { $ref: '#/components/responses/BadRequest' } }
 */
router.post(
  '/payouts/:id/paid',
  validate({ params: z.object({ id: uuid }) }),
  asyncHandler(async (req, res) => sendData(res, await markPayoutPaid(req.user.id, req.params.id, req))),
)

export default router
