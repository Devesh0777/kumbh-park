import 'dotenv/config'

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production'

const env = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: num(process.env.PORT, 4000),
  host: process.env.HOST ?? '0.0.0.0',

  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/nashik_parking',
  dbPoolMax: num(process.env.DATABASE_POOL_MAX, 10),
  dbSsl: bool(process.env.DATABASE_SSL, false),

  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me-access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-only-change-me-refresh',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '30m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',

  serviceKey: process.env.SERVICE_KEY ?? 'dev-only-change-me-service',

  otpExposeInResponse: bool(process.env.OTP_EXPOSE_IN_RESPONSE, !isProduction),
  otpTtlSeconds: num(process.env.OTP_TTL_SECONDS, 600),
  otpMaxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
  otpRateLimitPer15Min: num(process.env.OTP_RATE_LIMIT_PER_15MIN, 5),

  platformFeePct: num(process.env.PLATFORM_FEE_PCT, 12),
  currency: process.env.CURRENCY ?? 'INR',
  cancelFreeBeforeHours: num(process.env.CANCEL_FREE_BEFORE_HOURS, 2),
  defaultSearchRadiusKm: num(process.env.DEFAULT_SEARCH_RADIUS_KM, 8),
  maxSearchRadiusKm: num(process.env.MAX_SEARCH_RADIUS_KM, 25),
  maxActiveBookingsPerUser: num(process.env.MAX_ACTIVE_BOOKINGS_PER_USER, 5),

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  // express-rate-limit ceiling per IP per minute. Undefined here silently fell
  // back to the library default of 5/min, which throttles the smoke test and
  // the booking concurrency check (both burst well past 5 in a single window).
  rateLimitPerMinute: num(process.env.RATE_LIMIT_PER_MINUTE, isProduction ? 300 : 600),
  // Number of proxies in front of the app (0/1/...), or true when unknown.
  trustProxy: bool(process.env.TRUST_PROXY, false),
}

if (isProduction) {
  const weak = ['dev-only-change-me-access', 'dev-only-change-me-refresh', 'dev-only-change-me-service']
  for (const [key, value] of Object.entries({
    JWT_SECRET: env.jwtSecret,
    JWT_REFRESH_SECRET: env.jwtRefreshSecret,
    SERVICE_KEY: env.serviceKey,
  })) {
    if (weak.includes(value)) throw new Error(`${key} must be set to a strong value in production`)
  }
}

export default env
