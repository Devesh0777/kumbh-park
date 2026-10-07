/**
 * City-area overlays, ported from the nashik-monitor layer set.
 *
 * Source: nashik-monitor-v2-master/src/layers.ts
 *
 * The colours are kept exactly as nashik-monitor defines them. That palette is
 * not decorative: every layer was given its own hue window and a minimum
 * perceptual distance from every other layer, so the pair closest together is
 * still ΔE 7.6 apart and nothing collapses under protanopia, deuteranopia or
 * tritanopia. Recolouring to fit this app's palette would throw that away and
 * put the separation work back to zero.
 *
 * The glyph carries the identity independently of colour, which is why each
 * entry keeps a `symbol`. The app theme (red/light) is untouched by this file —
 * it only describes map data.
 *
 * Only layers that make sense for a Kumbh parking app were copied out of the
 * reference's 36; the rest (bus stops, waste fleet, grocery, malls, hostels,
 * CCTV, mandirs) are megabytes of data a driver does not need on screen.
 */
export const OVERLAY_GROUPS = [
  { id: 'Kumbh', label: 'Mela' },
  { id: 'Mobility', label: 'Traffic' },
  { id: 'Emergency', label: 'Emergency' },
  { id: 'Civic', label: 'Civic' },
]

export const MAP_OVERLAYS = [
  // ---- Kumbh ----------------------------------------------------------------
  // Off by default: the app already draws its own curated ghat labels
  // (KumbhMap's ghatPoints), and enabling this would label every ghat twice.
  {
    id: 'ghats',
    file: 'ghats.geojson',
    label: 'Ghats',
    color: '#7b3fba',
    group: 'Kumbh',
    symbol: '~',
  },
  {
    id: 'parking-zones',
    file: 'parking-zones.geojson',
    label: 'Parking zones',
    color: '#aa66dc',
    group: 'Kumbh',
    symbol: 'P',
    on: true,
  },
  {
    id: 'ring-road',
    file: 'ring-road.geojson',
    label: 'Ring road',
    color: '#570bdc',
    group: 'Kumbh',
    symbol: '○',
  },
  {
    id: 'congestion-points',
    file: 'congestion-points.geojson',
    label: 'Congestion',
    color: '#d18ceb',
    group: 'Kumbh',
    symbol: '!',
  },

  // ---- Mobility -------------------------------------------------------------
  {
    id: 'staging-areas',
    file: 'staging-areas.geojson',
    label: 'Staging areas',
    color: '#189ab7',
    group: 'Mobility',
    symbol: 'S',
  },
  {
    id: 'holding-areas',
    file: 'holding-areas.geojson',
    label: 'Holding areas',
    color: '#0154d5',
    group: 'Mobility',
    symbol: 'HA',
  },
  {
    id: 'emergency-routes',
    file: 'emergency-routes.geojson',
    label: 'Emergency routes',
    color: '#6b74c3',
    group: 'Mobility',
    symbol: 'E',
  },

  // ---- Emergency ------------------------------------------------------------
  {
    id: 'hospitals',
    file: 'hospitals.geojson',
    label: 'Hospitals',
    color: '#b81d2c',
    group: 'Emergency',
    symbol: '+',
  },
  {
    id: 'police-stations',
    file: 'police-stations.geojson',
    label: 'Police',
    color: '#f3888b',
    group: 'Emergency',
    symbol: '★',
  },
  {
    id: 'fire-stations',
    file: 'fire-stations.geojson',
    label: 'Fire stations',
    color: '#ff1f03',
    group: 'Emergency',
    symbol: '▼',
  },
  {
    id: 'ambulances',
    file: 'ambulances.geojson',
    label: 'Ambulances',
    color: '#854349',
    group: 'Emergency',
    symbol: 'A',
  },
  {
    id: 'blood-banks',
    file: 'blood-banks.geojson',
    label: 'Blood banks',
    color: '#dc0365',
    group: 'Emergency',
    symbol: '♦',
  },

  // ---- Civic ----------------------------------------------------------------
  {
    id: 'public-toilets',
    file: 'public-toilets.geojson',
    label: 'Public toilets',
    color: '#16cf05',
    group: 'Civic',
    symbol: 'WC',
  },
  {
    id: 'petrol-pumps',
    file: 'petrol-pumps.geojson',
    label: 'Petrol pumps',
    color: '#0b6557',
    group: 'Civic',
    symbol: 'F',
  },
]

/** Base URL for the static overlays. Vite serves `public/` at the site root. */
export const OVERLAY_BASE = `${import.meta.env.BASE_URL}data`

export const DEFAULT_OVERLAY_IDS = MAP_OVERLAYS.filter((layer) => layer.on).map((layer) => layer.id)

export function overlaysByGroup() {
  return OVERLAY_GROUPS.map((group) => ({
    ...group,
    layers: MAP_OVERLAYS.filter((layer) => layer.group === group.id),
  })).filter((group) => group.layers.length > 0)
}
