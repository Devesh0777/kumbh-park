import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import env from '../config/env.js'
import { z } from 'zod'
import { asyncHandler, sendData } from '../lib/http.js'
import { phone, validate } from '../lib/validate.js'
import { signAccessToken } from '../lib/jwt.js'
import { authenticate } from '../middleware/auth.js'
import {
  findUserById,
  issueRefreshToken,
  requestOtp,
  revokeRefreshToken,
  rotateRefreshToken,
  updateProfile,
  verifyOtp,
} from '../services/auth.service.js'

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.otpRateLimitPer15Min * 4,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth requests, slow down' } },
})

const router = Router()

/**
 * @openapi
 * /auth/otp/request:
 *   post:
 *     summary: Send a login OTP to a phone number
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+919876543210" }
 *               purpose: { type: string, enum: [login, register], default: login }
 *     responses:
 *       200:
 *         description: OTP issued. In development `devOtp` is included.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     phone: { type: string }
 *                     expiresInSeconds: { type: integer }
 *                     devOtp: { type: string, description: only when OTP_EXPOSE_IN_RESPONSE=true }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post(
  '/otp/request',
  otpLimiter,
  validate({ body: z.object({ phone, purpose: z.enum(['login', 'register']).default('login') }) }),
  asyncHandler(async (req, res) => sendData(res, await requestOtp(req.body))),
)

/**
 * @openapi
 * /auth/otp/verify:
 *   post:
 *     summary: Verify OTP, register on first use, return tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+919876543210" }
 *               code: { type: string, example: "123456" }
 *               name: { type: string, description: used only when the account is created }
 *               role: { type: string, enum: [pilgrim, host], default: pilgrim, description: honoured only for new accounts }
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  '/otp/verify',
  otpLimiter,
  validate({
    body: z.object({
      phone,
      code: z.string().length(6),
      name: z.string().min(2).max(80).optional(),
      role: z.enum(['pilgrim', 'host']).default('pilgrim'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await verifyOtp(req.body)
    const refresh = await issueRefreshToken(user, { userAgent: req.get('user-agent') })
    sendData(res, { user, accessToken: signAccessToken(user), refreshToken: refresh.token, expiresAt: refresh.expiresAt })
  }),
)

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Rotated tokens }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().min(10) }) }),
  asyncHandler(async (req, res) => {
    const { user, token, expiresAt } = await rotateRefreshToken(req.body.refreshToken, req.get('user-agent'))
    sendData(res, { user, accessToken: signAccessToken(user), refreshToken: token, expiresAt })
  }),
)

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties: { refreshToken: { type: string } }
 *     responses:
 *       200: { description: Revoked }
 */
router.post(
  '/logout',
  validate({ body: z.object({ refreshToken: z.string().min(10) }) }),
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.body.refreshToken)
    sendData(res, { revoked: true })
  }),
)

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Profile
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { data: { $ref: '#/components/schemas/User' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => sendData(res, await findUserById(req.user.id))),
)

/**
 * @openapi
 * /auth/me:
 *   patch:
 *     summary: Update own profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               photoUrl: { type: string }
 *               upiId: { type: string, description: host payout handle }
 *     responses:
 *       200: { description: Updated profile }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch(
  '/me',
  authenticate,
  validate({
    body: z.object({
      name: z.string().min(2).max(80).optional(),
      email: z.string().email().optional(),
      photoUrl: z.string().url().or(z.string().startsWith('data:')).optional(),
      upiId: z.string().max(80).optional(),
    }),
  }),
  asyncHandler(async (req, res) => sendData(res, await updateProfile(req.user.id, req.body))),
)

export default router
