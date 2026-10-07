import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'

import env from './config/env.js'
import { hasPostgis } from './config/postgis.js'
import buildSpec from './config/swagger.js'
import { ping } from './config/db.js'
import { logger } from './lib/logger.js'
import { errorHandler, notFound } from './middleware/error.js'

import authRoutes from './modules/auth.routes.js'
import spotsRoutes from './modules/spots.routes.js'
import zonesRoutes from './modules/zones.routes.js'
import bookingsRoutes from './modules/bookings.routes.js'
import hostRoutes from './modules/host.routes.js'
import adminRoutes from './modules/admin.routes.js'
import pricingRoutes from './modules/pricing.routes.js'
import reviewsRoutes from './modules/reviews.routes.js'
import parkingRoutes from './modules/parking-scan.routes.js'

export function createApp() {
  const app = express()

  // Required for correct client IPs (rate limiting) and req.ip in the audit log.
  app.set('trust proxy', env.trustProxy)
  app.disable('x-powered-by')

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key'],
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false, limit: '1mb' }))
  if (!env.isProduction) app.use(morgan('dev', { stream: { write: (line) => logger.info(line.trim()) } }))

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.rateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req) => req.path.startsWith('/health'),
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } },
    }),
  )

  // Cheap liveness: process is up. No dependencies touched.
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()), env: env.env }))

  // Readiness: database reachable, and reports which geo path is active.
  app.get('/ready', async (req, res) => {
    try {
      await ping()
      res.json({ status: 'ready', database: 'up', postgis: await hasPostgis() })
    } catch (err) {
      logger.error({ err: err.message }, 'readiness check failed')
      res.status(503).json({ status: 'unavailable', database: 'down' })
    }
  })

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(buildSpec(), { customSiteTitle: 'Nashik Parking Connect API' }))
  app.get('/openapi.json', (req, res) => res.json(buildSpec()))

  app.use('/api/v1/auth', authRoutes)
  app.use('/api/v1/spots', spotsRoutes)
  app.use('/api/v1/zones', zonesRoutes)
  app.use('/api/v1/bookings', bookingsRoutes)
  app.use('/api/v1/parking', parkingRoutes)
  app.use('/parking', parkingRoutes)
  app.use('/api/v1/host', hostRoutes)
  app.use('/api/v1/admin', adminRoutes)
  app.use('/api/v1/pricing', pricingRoutes)
  app.use('/api/v1', reviewsRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp
