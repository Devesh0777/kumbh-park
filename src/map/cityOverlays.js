import L from 'leaflet'
import { MAP_OVERLAYS, OVERLAY_BASE } from '@/config/mapLayers'

/**
 * Loads the static nashik-monitor overlays and renders them as Leaflet layers.
 *
 * Every feature is non-interactive: these are context, not controls. Letting
 * them swallow clicks would break "drop a pin on the map" and would make the
 * map feel broken wherever a big ring-road polygon sits.
 */

const cache = new Map()
const inflight = new Map()

/** Fetch + parse once per file, and share the promise between callers. */
export function loadOverlay(id) {
  const def = MAP_OVERLAYS.find((layer) => layer.id === id)
  if (!def) return Promise.reject(new Error(`Unknown overlay: ${id}`))
  if (cache.has(id)) return Promise.resolve(cache.get(id))
  if (inflight.has(id)) return inflight.get(id)

  const task = fetch(`${OVERLAY_BASE}/${def.file}`)
    .then((response) => {
      if (!response.ok) throw new Error(`${def.file} -> HTTP ${response.status}`)
      return response.json()
    })
    .then((geojson) => {
      cache.set(id, geojson)
      inflight.delete(id)
      return geojson
    })
    .catch((err) => {
      inflight.delete(id)
      // A missing overlay must never take the map down with it.
      console.warn(`[map] overlay "${id}" failed to load:`, err)
      throw err
    })

  inflight.set(id, task)
  return task
}

function pointStyle(def) {
  return {
    radius: 6,
    fillColor: def.color,
    fillOpacity: 0.95,
    color: '#ffffff',
    weight: 1.75,
    opacity: 1,
  }
}

function lineStyle(def) {
  return {
    color: def.color,
    weight: 3,
    opacity: 0.8,
    // Routes are corridors, not boundaries — dashing keeps them from reading
    // as district outlines next to the parking-zone polygons.
    dashArray: def.group === 'Mobility' ? '6 5' : null,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

function polygonStyle(def) {
  return {
    color: def.color,
    weight: 2,
    opacity: 0.85,
    fillColor: def.color,
    fillOpacity: 0.16,
  }
}

/** Build the Leaflet layer for one overlay definition. */
export function buildOverlayLayer(def, geojson) {
  const layer = L.geoJSON(geojson, {
    interactive: false,
    bubblingMouseEvents: false,
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointStyle(def)),
    style: (feature) => {
      switch (feature.geometry?.type) {
        case 'Point':
        case 'MultiPoint':
          return {}
        case 'LineString':
        case 'MultiLineString':
          return lineStyle(def)
        default:
          return polygonStyle(def)
      }
    },
  })

  // Points get the white halo nashik-monitor draws under every symbol, so a
  // marker stays legible over both the pale basemap and a dark polygon fill.
  L.geoJSON(geojson, {
    interactive: false,
    bubblingMouseEvents: false,
    filter: (feature) => /Point$/.test(feature.geometry?.type ?? ''),
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 8.5,
        fillColor: '#ffffff',
        fillOpacity: 0.85,
        color: '#ffffff',
        weight: 0,
        opacity: 0,
      }),
  }).eachLayer((halo) => layer.addLayer(halo))

  return layer
}

/** Remove every layer in the map that this module owns. */
export function clearOverlays(map, owned) {
  for (const layer of owned.values()) {
    if (map.hasLayer(layer)) map.removeLayer(layer)
  }
  owned.clear()
}
