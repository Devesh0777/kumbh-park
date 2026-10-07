const EARTH_RADIUS_KM = 6371

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Rough walking estimate at 4.5 km/h — used for "5 min walk" on cards */
export function walkMinutes(km) {
  if (km == null) return null
  return Math.max(1, Math.round((km / 4.5) * 60))
}

export function boundsOf(points) {
  if (!points?.length) return null
  const lats = points.map((p) => p[0])
  const lngs = points.map((p) => p[1])
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ]
}

export function centerOf(points) {
  const bounds = boundsOf(points)
  if (!bounds) return null
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
}
