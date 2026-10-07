import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { recordAudit } from '../middleware/error.js'
import { quote } from '../lib/pricing.js'

/**
 * POST /pricing/surge
 *
 * Interface only. A separate ML/demand service owns prediction; this endpoint is
 * the contract it writes through, protected by X-Service-Key rather than a user
 * token. Windows overlap, so the booking path picks the highest matching
 * multiplier (see `pickMultiplier`).
 */
export const upsertSurgeWindow = async (adminId, payload, req) => {
  const { zoneId, startISO, endISO, multiplier, reason, modelVersion } = payload
  if (new Date(endISO) <= new Date(startISO)) throw ApiError.badRequest('windowEnd must be after windowStart')
  if (multiplier < 1 || multiplier > 5) throw ApiError.badRequest('multiplier must be between 1 and 5')

  return withTransaction(async (client) => {
    // An identical zone + window is updated in place so retries stay idempotent.
    const { rows } = await client.query(
      `INSERT INTO zone_demand (zone_id, window_start, window_end, multiplier, reason, source, model_version)
       VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, 'ml', $6)
       ON CONFLICT (zone_id, window_start, window_end) DO UPDATE
         SET multiplier = EXCLUDED.multiplier,
             reason = EXCLUDED.reason,
             model_version = EXCLUDED.model_version,
             source = 'ml',
             updated_at = now()
       RETURNING id, zone_id, window_start, window_end, multiplier, reason, model_version, updated_at`,
      [zoneId, startISO, endISO, multiplier, reason ?? null, modelVersion ?? null],
    )
    await recordAudit(client, {
      actor: { id: adminId, role: 'admin' },
      action: 'surge.upsert',
      entityType: 'zone_demand',
      entityId: rows[0].id,
      after: { zoneId, multiplier, startISO, endISO },
      reason,
      req,
    })
    return shapeSurge(rows[0])
  })
}

export const deleteSurgeWindow = async (adminId, id, req) => {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query('DELETE FROM zone_demand WHERE id = $1', [id])
    if (!rowCount) throw ApiError.notFound('Surge window not found')
    await recordAudit(client, {
      actor: { id: adminId, role: 'admin' },
      action: 'surge.delete',
      entityType: 'zone_demand',
      entityId: id,
      req,
    })
    return { id, deleted: true }
  })
}

export const listSurgeWindows = async ({ zoneId, activeOnly = true } = {}) => {
  const { rows } = await query(
    `SELECT zd.*, z.name AS zone_name, z.slug
     FROM zone_demand zd JOIN zones z ON z.id = zd.zone_id
     WHERE ($1::text IS NULL OR zd.zone_id = $1::text)
       AND ($2::boolean = false OR zd.window_end > now())
     ORDER BY zd.window_start ASC`,
    [zoneId ?? null, activeOnly],
  )
  return rows.map((row) => ({ ...shapeSurge(row), zoneName: row.zone_name, zoneSlug: row.slug }))
}

export const getSurgeForZone = async (zoneId, startISO, endISO) => {
  const { rows } = await query(
    `SELECT zd.*, z.name AS zone_name FROM zone_demand zd
     JOIN zones z ON z.id = zd.zone_id
     WHERE zd.zone_id = $1 AND zd.window_start < $3::timestamptz AND zd.window_end > $2::timestamptz
     ORDER BY zd.multiplier DESC`,
    [zoneId, startISO, endISO],
  )
  return rows.map((row) => ({ ...shapeSurge(row), zoneName: row.zone_name }))
}

/**
 * GET /pricing/quote?zoneId=&start=&end=&hours=
 * A zone-level preview, useful for the "mela surge is active" banner.
 */
export const quoteForZone = async ({ zoneId, startISO, endISO, hours = 2, pricePerHour = 40 }) => {
  const windows = await getSurgeForZone(zoneId, startISO, endISO)
  const top = windows[0] ?? null
  return {
    zoneId,
    start: startISO,
    end: endISO,
    surgeActive: Boolean(top),
    multiplier: top ? Number(top.multiplier) : 1,
    reason: top?.reason ?? null,
    pricing: quote({ pricePerHour, hours: Number(hours), multiplier: top ? Number(top.multiplier) : 1 }),
  }
}

function shapeSurge(row) {
  return {
    id: row.id,
    zoneId: row.zone_id,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    multiplier: Number(row.multiplier),
    reason: row.reason,
    source: row.source,
    modelVersion: row.model_version,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
