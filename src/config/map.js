/**
 * Map configuration.
 *
 * Tiles: the spec (§5) forbids hitting raw OSM tile servers in production.
 * The default provider below is convenient for local development — swap
 * `VITE_TILE_PROVIDER` (see .env.example) for a free-tier provider or a
 * self-hosted tile stack before this ships.
 */

const provider = import.meta.env.VITE_TILE_PROVIDER || 'osm'

const providers = {
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  stadia: {
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key={key}',
    attribution: '&copy; Stadia Maps, &copy; OpenStreetMap contributors',
    maxZoom: 20,
  },
  maptiler: {
    url: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
    attribution: '&copy; MapTiler, &copy; OpenStreetMap contributors',
    maxZoom: 20,
  },
  url: {
    url: '{url}',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
}

const keys = {
  stadia: import.meta.env.VITE_STADIA_API_KEY,
  maptiler: import.meta.env.VITE_MAPTILER_API_KEY,
  url: import.meta.env.VITE_TILE_URL,
}

const chosen = providers[provider] ?? providers.osm
const key = keys[provider]

export const TILE_LAYER = {
  url: chosen.url.replace('{key}', key ?? '').replace('{url}', key ?? ''),
  attribution: chosen.attribution,
  maxZoom: chosen.maxZoom,
}

/** Nashik Kumbh Mela spread, centered in Nashik city towards Trimbakeshwar. */
export const NASHIK_CENTER = [19.9975, 73.7898]
export const DEFAULT_ZOOM = 12
export const CITY_BOUNDS = [
  [19.85, 73.45],
  [20.15, 73.95],
]
