import { query } from './db.js'

/**
 * PostGIS is used when the extension is present. On a plain Postgres install
 * the same queries fall back to an inline haversine expression so local setup
 * never blocks on an extension install.
 */
let cached = null

export async function hasPostgis() {
  if (cached !== null) return cached
  try {
    const { rows } = await query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS present")
    cached = rows[0].present === true
  } catch {
    cached = false
  }
  return cached
}

const EARTH_RADIUS_KM = 6371

/**
 * Builds the SQL fragment + params used to filter/order spots by distance from
 * a lat/lng. Returns `distanceExpr` in kilometres.
 *
 * @param {{lat:number, lng:number}} origin
 * @param {{withDistance:boolean, alias?:string, params?:any[]}} options
 */
export async function distanceSql(origin, { withDistance = true, alias = 's' } = {}) {
  if (await hasPostgis()) {
    const expr = 'ST_Distance(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000'
    return {
      distanceExpr: withDistance ? expr : '0',
      withinExpr: `ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)`,
      usesGeometry: true,
    }
  }
  const lat1 = `$${origin.latIndex ?? 1}::double precision`
  void alias
  return {
    distanceExpr: withDistance
      ? `(2 * 6371 * asin(sqrt(power(sin(radians($${origin.latIndex ?? 1} - s.latitude) / 2), 2) + cos(radians(s.latitude)) * cos(radians($${origin.latIndex ?? 1})) * power(sin(radians($${origin.lngIndex ?? 2} - s.longitude) / 2), 2))))`
      : '0',
    withinExpr: `(2 * 6371 * asin(sqrt(power(sin(radians($${origin.latIndex ?? 1} - s.latitude) / 2), 2) + cos(radians(s.latitude)) * cos(radians($${origin.latIndex ?? 1})) * power(sin(radians($${origin.lngIndex ?? 2} - s.longitude) / 2), 2)))) <= $3`,
    usesGeometry: false,
  }
}

export { EARTH_RADIUS_KM }
