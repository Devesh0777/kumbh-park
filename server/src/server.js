import env from './config/env.js'
import { close, ping } from './config/db.js'
import { hasPostgis } from './config/postgis.js'
import { logger } from './lib/logger.js'
import { createApp } from './app.js'

async function main() {
  // The API is designed to boot without a database: /health stays 200, /ready
  // reports 503, and every DB-backed route fails through the error handler.
  // Exiting here made that graceful degradation unreachable.
  let geo = 'haversine fallback (PostGIS not installed)'
  try {
    await ping()
    logger.info('database connection established')
    geo = (await hasPostgis()) ? 'PostGIS' : 'haversine fallback (PostGIS not installed)'
  } catch (err) {
    logger.error({ err: err.message }, 'cannot reach the database. Check DATABASE_URL in .env')
    logger.warn('starting in degraded mode: /ready will report 503 until the database is reachable')
  }
  logger.info(`geospatial search mode: ${geo}`)

  const app = createApp()
  const server = app.listen(env.port, () => {
    logger.info(`api listening on http://localhost:${env.port}`)
    logger.info(`swagger ui at http://localhost:${env.port}/docs`)
  })

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`)
    server.close(async () => {
      await close()
      process.exit(0)
    })
    // Do not let a hung connection block the exit forever.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => logger.error({ reason: String(reason) }, 'unhandled rejection'))
}

main().catch((err) => {
  logger.error({ err: err.message }, 'failed to start')
  process.exit(1)
})
