import swaggerJsdoc from 'swagger-jsdoc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import env from './env.js'

// Resolve globs relative to this file so the spec works from src/ and dist/ alike.
const here = path.dirname(fileURLToPath(import.meta.url))
const rel = (...segments) => path.join(here, ...segments).replace(/\\/g, '/')

/**
 * OpenAPI 3 document. Route-level docs live next to each handler as
 * `@openapi` JSDoc blocks, so the spec cannot drift from the implementation.
 */
export default function buildSpec() {
  return swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'Nashik Parking Connect API',
        version: '1.0.0',
        description: [
          'Backend for the Kumbh Mela parking marketplace: pilgrims find and book parking,',
          'hosts list and manage bays, admins verify listings and monitor occupancy.',
          '',
          '### Auth flow',
          '1. `POST /auth/otp/request` with a phone number.',
          '2. `POST /auth/otp/verify` with the code. In development the code is returned as `devOtp`.',
          '3. Send the access token as `Authorization: Bearer <accessToken>`.',
          '4. Refresh with `POST /auth/refresh`; refresh tokens rotate on every use.',
          '',
          '### Booking concurrency',
          '`POST /bookings` claims one bay with `SELECT ... FOR UPDATE SKIP LOCKED` inside a',
          'transaction, backed by a database exclusion constraint on `(slot_id, time_window)`.',
          'A lost race returns `409` with code `SLOT_TAKEN` or `NO_BAYS_FREE`.',
          '',
          '### Surge pricing',
          '`POST /pricing/surge` is a service-to-service endpoint authenticated with',
          '`X-Service-Key`, intended for the demand/ML service. Windows may overlap; the highest',
          'matching multiplier is applied to a booking.',
        ].join('\n'),
        license: { name: 'MIT' },
      },
      servers: [
        { url: `http://localhost:${env.port}`, description: 'Local development' },
        { url: '/', description: 'Same origin (behind a proxy)' },
      ],
      tags: [
        { name: 'Auth', description: 'OTP login, tokens, profile' },
        { name: 'Discovery', description: 'Zones, nearby search, spot detail, reviews' },
        { name: 'Bookings', description: 'Quotes, booking lifecycle, check in/out' },
        { name: 'Host', description: 'Listings, availability, bookings, earnings' },
        { name: 'Admin', description: 'Verification, occupancy, issues, payouts, audit' },
        { name: 'Pricing', description: 'Surge windows and quotes' },
        { name: 'Reviews', description: 'Ratings and problem reports' },
        { name: 'System', description: 'Health and readiness' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          serviceKey: { type: 'apiKey', in: 'header', name: 'X-Service-Key' },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'SLOT_TAKEN' },
                  message: { type: 'string' },
                  details: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
          PageMeta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              total: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
          User: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              phone: { type: 'string', example: '+919876543210' },
              name: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              role: { type: 'string', enum: ['pilgrim', 'host', 'admin'] },
              photo_url: { type: 'string', nullable: true },
              is_verified: { type: 'boolean' },
              is_suspended: { type: 'boolean' },
              suspended_reason: { type: 'string', nullable: true },
              host_since: { type: 'string', format: 'date-time', nullable: true },
              response_time: { type: 'string', nullable: true },
              upi_id: { type: 'string', nullable: true },
              rating: { type: 'number', nullable: true },
              rating_count: { type: 'integer' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          Zone: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: 'Ramkund' },
              slug: { type: 'string', example: 'ramkund' },
              mela_note: { type: 'string', nullable: true },
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              demand_tag: { type: 'string', nullable: true },
              sort_order: { type: 'integer' },
              spot_count: { type: 'integer' },
            },
          },
          Spot: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              description: { type: 'string', nullable: true },
              address: { type: 'string' },
              landmark: { type: 'string', nullable: true },
              lat: { type: 'number' },
              lng: { type: 'number' },
              distanceKm: { type: 'number', nullable: true, description: 'null when the search had no origin' },
              pricePerHour: { type: 'number' },
              pricePerDay: { type: 'number' },
              minBookingHours: { type: 'number' },
              maxBookingHours: { type: 'number' },
              availabilityWindows: { type: 'array', items: { type: 'object' } },
              features: { type: 'array', items: { type: 'string' } },
              surface: { type: 'string', nullable: true },
              clearanceM: { type: 'number', nullable: true },
              gateInstructions: { type: 'string', nullable: true },
              checkInFrom: { type: 'string', example: '05:00' },
              checkOutBy: { type: 'string', example: '23:00' },
              photos: { type: 'array', items: { type: 'string' } },
              coverPhoto: { type: 'string', nullable: true },
              status: { type: 'string', enum: ['draft', 'pending', 'verified', 'rejected', 'suspended'] },
              isAccepting: { type: 'boolean' },
              instantBook: { type: 'boolean' },
              rating: { type: 'number', nullable: true },
              reviewCount: { type: 'integer' },
              zone: { $ref: '#/components/schemas/Zone' },
              availability: { type: 'string', enum: ['available', 'filling', 'full'] },
              bays: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  free: { type: 'integer', nullable: true },
                },
              },
              capacity: {
                type: 'object',
                properties: {
                  '2w': { type: 'integer' },
                  car: { type: 'integer' },
                  bus: { type: 'integer' },
                },
              },
              host: { $ref: '#/components/schemas/User' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          Booking: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              status: { type: 'string', enum: ['confirmed', 'checked_in', 'completed', 'cancelled'] },
              plan: { type: 'string', enum: ['hourly', 'daily'] },
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' },
              hours: { type: 'number' },
              pricing: {
                type: 'object',
                properties: {
                  base: { type: 'number' },
                  surgeMultiplier: { type: 'number' },
                  surgeAmount: { type: 'number' },
                  platformFee: { type: 'number' },
                  total: { type: 'number' },
                  currency: { type: 'string', example: 'INR' },
                },
              },
              vehicle: {
                type: 'object',
                properties: { number: { type: 'string' }, type: { type: 'string' } },
              },
              pinCode: { type: 'string', description: 'one-time PIN, returned only on create/regenerate' },
              spot: { type: 'object' },
              host: { type: 'object' },
              checkIn: { type: 'object' },
            },
          },
        },
        responses: {
          BadRequest: {
            description: 'Validation or business rule failure',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          Unauthorized: {
            description: 'Missing, expired, or invalid token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          Forbidden: {
            description: 'Authenticated but not allowed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          NotFound: {
            description: 'Resource does not exist',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          RateLimited: {
            description: 'Too many requests',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    // Only scan our own source: the default globs would pick up node_modules docs.
    apis: [`${rel('..', 'modules')}/*.routes.js`, rel('..', 'app.js')],
  })
}
