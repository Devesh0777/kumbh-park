import { query, withTransaction } from '../config/db.js'
import { distanceSql, hasPostgis } from '../config/postgis.js'
import { ApiError } from '../lib/errors.js'
import env from '../config/env.js'
import { recordAudit } from '../middleware/error.js'

const SPOT_COLUMNS = `
  s.id, s.host_id, s.zone_id, s.title, s.description, s.address, s.landmark,
  s.latitude, s.longitude, s.capacity_2w, s.capacity_car, s.capacity_bus,
  s.price_per_hour, s.price_per_day, s.min_booking_hours, s.max_booking_hours,
  s.availability_windows, s.features, s.surface, s.clearance_m, s.gate_instructions,
  s.check_in_from, s.check_out_by, s.photos, s.status, s.is_accepting,
  s.rating, s.review_count, s.instant_book, s.created_at`

const SPOT_JOINS = `
  FROM parking_spots s
  JOIN zones z ON z.id = s.zone_id
  JOIN users u ON u.id = s.host_id`

const hostFields = `
  u.id AS host_user_id, u.name AS host_name, u.photo_url AS host_photo_url,
  u.is_verified AS host_verified, u.host_since, u.response_time AS host_response_time,
  u.rating AS host_rating, u.rating_count AS host_rating_count`

/**
 * Availability for one spot over a window: how many bays are free per vehicle
 * type, counting overlapping active bookings and host-blocked bays.
 */
export async function availabilityFor(spotIds, { startISO, endISO, vehicleType }) {
  if (spotIds.length === 0) return new Map()
  const { rows } = await query(
    `SELECT s.id AS spot_id,
            sl.vehicle_type,
            count(*) FILTER (WHERE sl.is_currently_available)::int AS bays_total,
            count(*) FILTER (
              WHERE sl.is_currently_available
                AND NOT EXISTS (
                  SELECT 1 FROM bookings b
                  WHERE b.slot_id = sl.id
                    AND b.status IN ('confirmed', 'checked_in')
                    AND b.time_window && tstzrange($2::timestamptz, $3::timestamptz)
                )
            )::int AS bays_free,
            count(*) FILTER (
              WHERE sl.is_currently_available
                AND b.id IS NOT NULL
            )::int AS bays_busy
       FROM parking_spots s
       JOIN slots sl ON sl.spot_id = s.id
       LEFT JOIN bookings b
              ON b.slot_id = sl.id
             AND b.status IN ('confirmed', 'checked_in')
             AND b.time_window && tstzrange($2::timestamptz, $3::timestamptz)
      WHERE s.id = ANY($1::uuid[])
      GROUP BY s.id, sl.vehicle_type`,
    [spotIds, startISO, endISO],
  )

  const map = new Map()
  for (const row of rows) {
    const entry = map.get(row.spot_id) ?? { total: {}, free: {} }
    entry.total[row.vehicle_type] = row.bays_total
    entry.free[row.vehicle_type] = row.bays_free
    map.set(row.spot_id, entry)
  }
  if (vehicleType) return map
  return map
}

/**
 * GET /spots/nearby
 *
 * Geospatial search. Uses PostGIS ST_DWithin/ST_Distance when the extension is
 * installed, otherwise an inline haversine expression - both return
 * `distance_km` and are sorted by it.
 */
export async function findNearby({
  lat,
  lng,
  radiusKm = env.defaultSearchRadiusKm,
  vehicleType,
  startISO,
  endISO,
  zone,
  minPrice,
  maxPrice,
  instantBook,
  features,
  sort = 'distance',
  page = 1,
  pageSize = 20,
}) {
  const limitRadius = Math.min(Number(radiusKm) || env.defaultSearchRadiusKm, env.maxSearchRadiusKm)
  const params = [lat, lng, limitRadius]
  // distanceSql references $1,$2 (origin) and $3 (radius); keep those slots first.
  const geo = await distanceSql({ lat, lng })
  const add = (value) => {
    params.push(value)
    return `$${params.length}`
  }

  const where = ["s.status = 'verified'", 's.is_accepting = true']
  const pVehicle = add(vehicleType ?? 'car')
  let pStart = null
  let pEnd = null

  if (startISO && endISO) {
    pStart = add(startISO)
    pEnd = add(endISO)
  }

  // Always require at least one free bay of the requested type.
  where.push(`
    EXISTS (
      SELECT 1 FROM slots sl
      WHERE sl.spot_id = s.id
        AND sl.vehicle_type = ${pVehicle}
        AND sl.is_currently_available
        ${pStart ? `AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.slot_id = sl.id
            AND b.status IN ('confirmed', 'checked_in')
            AND b.time_window && tstzrange(${pStart}::timestamptz, ${pEnd}::timestamptz)
        )` : ''}
    )`)

  if (zone) where.push(`s.zone_id = ${add(zone)}`)
  if (minPrice != null) where.push(`s.price_per_hour >= ${add(minPrice)}`)
  if (maxPrice != null) where.push(`s.price_per_hour <= ${add(maxPrice)}`)
  if (instantBook) where.push('s.instant_book = true')
  if (features?.length) where.push(`s.features @> ${add(JSON.stringify(features))}::jsonb`)

  const whereSql = `${geo.withinExpr} AND ${where.join(' AND ')}`

  const orderSql =
    {
      distance: 'distance_km ASC, s.price_per_hour ASC',
      price: 's.price_per_hour ASC, distance_km ASC',
      rating: 's.rating DESC NULLS LAST, distance_km ASC',
      availability: 'free_bays DESC, distance_km ASC',
    }[sort] ?? 'distance_km ASC'

  const freeBaysExpr = `
    (SELECT count(*)::int FROM slots sl
      WHERE sl.spot_id = s.id
        AND sl.vehicle_type = ${pVehicle}
        AND sl.is_currently_available
        ${pStart ? `AND NOT EXISTS (
          SELECT 1 FROM bookings bk
          WHERE bk.slot_id = sl.id
            AND bk.status IN ('confirmed','checked_in')
            AND bk.time_window && tstzrange(${pStart}::timestamptz, ${pEnd}::timestamptz)
        )` : ''})`

  // One pass for the page, one for the total; both share the exact same FROM/WHERE
  // so `meta.total` and the returned items can never disagree.
  const fromSql = `${SPOT_JOINS} WHERE ${whereSql}`

  const rowsSql = `
    SELECT ${SPOT_COLUMNS}, ${hostFields}, ${geo.distanceExpr} AS distance_km,
           (s.photos->0) AS cover_photo,
           ${freeBaysExpr} AS free_bays,
           (SELECT count(*)::int FROM slots sl
             WHERE sl.spot_id = s.id AND sl.vehicle_type = ${pVehicle} AND sl.is_currently_available) AS bays_total,
           (SELECT json_build_object('id', z.id, 'name', z.name, 'slug', z.slug, 'mela_note', z.mela_note)
              FROM zones z WHERE z.id = s.zone_id) AS zone
    ${fromSql}
    ORDER BY ${orderSql}
    LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`

  const [{ rows }, { rows: countRows }] = await Promise.all([
    query(rowsSql, params),
    query(`SELECT count(*)::int AS total ${fromSql}`, params.slice(0, params.length - 2)),
  ])

  return { items: rows.map(shapeSpot), total: countRows[0].total }
}

export async function getSpot(id, { withAvailabilityFor } = {}) {
  const { rows } = await query(
    `SELECT ${SPOT_COLUMNS}, ${hostFields},
            (s.photos->0) AS cover_photo,
            (SELECT json_build_object('id', z.id, 'name', z.name, 'slug', z.slug, 'mela_note', z.mela_note)
             FROM zones z WHERE z.id = s.zone_id) AS zone
     ${SPOT_JOINS}
     WHERE s.id = $1`,
    [id],
  )
  const spot = rows[0]
  if (!spot) throw ApiError.notFound('Parking spot not found')

  if (withAvailabilityFor?.startISO && withAvailabilityFor?.endISO) {
    const map = await availabilityFor([spot.id], withAvailabilityFor)
    spot.availability_by_type = map.get(spot.id) ?? { total: {}, free: {} }
  } else {
    const { rows: counts } = await query(
      `SELECT vehicle_type, count(*) FILTER (WHERE is_currently_available)::int AS free, count(*)::int AS total
       FROM slots WHERE spot_id = $1 GROUP BY vehicle_type`,
      [id],
    )
    spot.availability_by_type = {
      total: Object.fromEntries(counts.map((c) => [c.vehicle_type, c.total])),
      free: Object.fromEntries(counts.map((c) => [c.vehicle_type, c.free])),
    }
  }
  return shapeSpot(spot)
}

export const listZones = async () => {
  const { rows } = await query(
    `SELECT z.id, z.name, z.slug, z.mela_note, z.latitude, z.longitude, z.demand_tag, z.sort_order,
            (SELECT count(*)::int FROM parking_spots s WHERE s.zone_id = z.id AND s.status = 'verified') AS spot_count
     FROM zones z ORDER BY z.sort_order, z.name`,
  )
  return rows
}

export const getZone = async (id) => {
  const { rows } = await query('SELECT * FROM zones WHERE id = $1 OR slug = $1', [id])
  if (!rows[0]) throw ApiError.notFound('Zone not found')
  return rows[0]
}

export async function getReviews(spotId, { page = 1, pageSize = 20 } = {}) {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS author, u.photo_url AS author_photo
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.spot_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [spotId, pageSize, (page - 1) * pageSize],
  )
  const { rows: countRows } = await query('SELECT count(*)::int AS total FROM reviews WHERE spot_id = $1', [spotId])
  return { items: rows, total: countRows[0].total }
}

/** Shapes a raw row into the camelCase payload the frontend consumes. */
export function shapeSpot(row) {
  const total =
    (row.bays_total ?? 0) ||
    Number(row.capacity_2w ?? 0) + Number(row.capacity_car ?? 0) + Number(row.capacity_bus ?? 0)
  const free = row.free_bays ?? null
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    address: row.address,
    landmark: row.landmark,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    distanceKm: row.distance_km != null ? Number(Number(row.distance_km).toFixed(2)) : null,
    pricePerHour: Number(row.price_per_hour),
    pricePerDay: Number(row.price_per_day),
    minBookingHours: row.min_booking_hours,
    maxBookingHours: row.max_booking_hours,
    availabilityWindows: row.availability_windows ?? [],
    features: row.features ?? [],
    surface: row.surface,
    clearanceM: row.clearance_m != null ? Number(row.clearance_m) : null,
    gateInstructions: row.gate_instructions,
    checkInFrom: row.check_in_from,
    checkOutBy: row.check_out_by,
    photos: row.photos ?? [],
    coverPhoto: row.cover_photo ?? (row.photos ?? [])[0] ?? null,
    status: row.status,
    isAccepting: row.is_accepting,
    instantBook: row.instant_book,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count,
    zone: row.zone ?? null,
    zoneId: row.zone_id,
    availability: availabilityLabel(free, total),
    bays: { total, free },
    capacity: {
      '2w': row.capacity_2w,
      car: row.capacity_car,
      bus: row.capacity_bus,
    },
    host: {
      id: row.host_user_id ?? row.host_id,
      name: row.host_name,
      photoUrl: row.host_photo_url,
      verified: row.host_verified ?? false,
      hostingSince: row.host_since,
      responseTime: row.host_response_time,
      rating: row.host_rating != null ? Number(row.host_rating) : null,
      ratingCount: row.host_rating_count ?? 0,
    },
    createdAt: row.created_at,
  }
}

function availabilityLabel(free, total) {
  if (free == null) return 'available'
  if (free <= 0) return 'full'
  if (total > 0 && free / total <= 0.34) return 'filling'
  return 'available'
}

/**
 * Materialises one `slots` row per physical bay from a spot's per-type capacity.
 * Called when a listing is approved, and when a verified host changes capacity.
 * Without it a spot has no bays and can never be booked, because search requires
 * a free slot row to exist. Idempotent on (spot_id, code).
 */
export async function materialiseSlots(client, spotId, { '2w': twoW, car, bus }) {
  let created = 0
  for (const [vehicleType, count] of [
    ['2w', twoW],
    ['car', car],
    ['bus', bus],
  ]) {
    const total = Number(count ?? 0)
    if (!Number.isFinite(total) || total <= 0) continue
    for (let i = 1; i <= total; i += 1) {
      const { rowCount } = await client.query(
        `INSERT INTO slots (spot_id, vehicle_type, code)
         VALUES ($1, $2, $3) ON CONFLICT (spot_id, code) DO NOTHING`,
        [spotId, vehicleType, `${vehicleType.toUpperCase()}-${String(i).padStart(2, '0')}`],
      )
      created += rowCount
    }
  }
  return created
}

/** Shared with the host module: hosts write their own listings. */
export async function createSpot(hostId, payload, req) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO parking_spots (
         host_id, zone_id, title, description, address, landmark, latitude, longitude,
         capacity_2w, capacity_car, capacity_bus, price_per_hour, price_per_day,
         min_booking_hours, max_booking_hours, availability_windows, features,
         surface, clearance_m, gate_instructions, check_in_from, check_out_by,
         photos, status, instant_book)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22,$23::jsonb,$24,$25)
       RETURNING *`,
      [
        hostId,
        payload.zoneId,
        payload.title,
        payload.description ?? null,
        payload.address,
        payload.landmark ?? null,
        payload.lat,
        payload.lng,
        payload.capacity?.['2w'] ?? 0,
        payload.capacity?.car ?? 0,
        payload.capacity?.bus ?? 0,
        payload.pricePerHour,
        payload.pricePerDay,
        payload.minBookingHours ?? 1,
        payload.maxBookingHours ?? 24,
        JSON.stringify(payload.availabilityWindows ?? []),
        JSON.stringify(payload.features ?? []),
        payload.surface ?? null,
        payload.clearanceM ?? null,
        payload.gateInstructions ?? null,
        payload.checkInFrom ?? '05:00',
        payload.checkOutBy ?? '23:00',
        JSON.stringify(payload.photos ?? []),
        payload.submit ? 'pending' : 'draft',
        payload.instantBook ?? true,
      ],
    )
    const spot = rows[0]
    await recordAudit(client, {
      actor: { id: hostId, role: 'host' },
      action: 'spot.create',
      entityType: 'parking_spot',
      entityId: spot.id,
      after: { title: spot.title, status: spot.status },
      req,
    })
    return spot
  })
}

export { SPOT_COLUMNS, SPOT_JOINS, hostFields, hasPostgis }
