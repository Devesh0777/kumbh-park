/**
 * Nashik Monitor Dataset Definitions & Layer Metadata
 * Direct integration from nashik-monitor-v2-master
 */

export const GROUPS = ['Kumbh', 'Mobility', 'Emergency', 'Civic', 'Stay', 'Shops']

export const LAYERS = [
  // ---- Kumbh ----
  { id: 'ghats', file: 'ghats.geojson', label: 'Ghats', color: '#7b3fba', group: 'Kumbh', symbol: '~', on: true, labels: true },
  { id: 'parking-zones', file: 'parking-zones.geojson', label: 'Parking zones', color: '#aa66dc', group: 'Kumbh', symbol: 'P', on: true },
  { id: 'ring-road', file: 'ring-road.geojson', label: 'Ring road', color: '#570bdc', group: 'Kumbh', symbol: '○', on: true },
  { id: 'congestion-points', file: 'congestion-points.geojson', label: 'Congestion points', color: '#d18ceb', group: 'Kumbh', symbol: '!' },
  { id: 'cctv-cameras', file: 'cctv-cameras.geojson', label: 'CCTV cameras', color: '#e44ff7', group: 'Kumbh', symbol: '●' },
  { id: 'mandirs', file: 'mandirs.geojson', label: 'Mandirs', color: '#6b55ff', group: 'Kumbh', symbol: '▲' },

  // ---- Mobility ----
  { id: 'staging-areas', file: 'staging-areas.geojson', label: 'Staging areas', color: '#189ab7', group: 'Mobility', symbol: 'S', labels: true },
  { id: 'holding-areas', file: 'holding-areas.geojson', label: 'Holding areas', color: '#0154d5', group: 'Mobility', symbol: 'HA', labels: true },
  { id: 'railway-station', file: 'railway-station.geojson', label: 'Station access plans', color: '#474f93', group: 'Mobility', symbol: 'R', labels: true },
  { id: 'vip-routes', file: 'vip-routes.geojson', label: 'VIP routes', color: '#939ecd', group: 'Mobility', symbol: 'VIP', labels: true },
  { id: 'emergency-routes', file: 'emergency-routes.geojson', label: 'Emergency routes', color: '#6b74c3', group: 'Mobility', symbol: 'E', labels: true },
  { id: 'movement-routes', file: 'movement-routes.geojson', label: 'Movement routes', color: '#32b7ff', group: 'Mobility', symbol: 'MV', labels: true },
  { id: 'bus-depots', file: 'bus-depots.geojson', label: 'Bus depots', color: '#0c7598', group: 'Mobility', symbol: 'BD', labels: true },
  { id: 'bus-stops', file: 'bus-stops.geojson', label: 'Bus stops', color: '#148ffd', group: 'Mobility', symbol: 'B' },

  // ---- Emergency ----
  { id: 'hospitals', file: 'hospitals.geojson', label: 'Hospitals', color: '#b81d2c', group: 'Emergency', symbol: '+', on: true },
  { id: 'police-stations', file: 'police-stations.geojson', label: 'Police stations', color: '#f3888b', group: 'Emergency', symbol: '★', on: true },
  { id: 'ambulances', file: 'ambulances.geojson', label: 'Ambulances', color: '#854349', group: 'Emergency', symbol: 'A' },
  { id: 'fire-stations', file: 'fire-stations.geojson', label: 'Fire stations', color: '#ff1f03', group: 'Emergency', symbol: '▼' },
  { id: 'blood-banks', file: 'blood-banks.geojson', label: 'Blood banks', color: '#dc0365', group: 'Emergency', symbol: '♦' },
  { id: 'diagnostic-labs', file: 'diagnostic-labs.geojson', label: 'Diagnostic labs', color: '#fc5085', group: 'Emergency', symbol: 'Rx' },

  // ---- Civic ----
  { id: 'public-toilets', file: 'public-toilets.geojson', label: 'Public toilets', color: '#16cf05', group: 'Civic', symbol: 'WC' },
  { id: 'petrol-pumps', file: 'petrol-pumps.geojson', label: 'Petrol pumps', color: '#0b6557', group: 'Civic', symbol: 'F' },
  { id: 'car-service-centers', file: 'car-service-centers.geojson', label: 'Car service', color: '#5f9a6f', group: 'Civic', symbol: 'C' },
  { id: 'two-wheeler-service', file: 'two-wheeler-service.geojson', label: 'Two-wheeler service', color: '#7fc15c', group: 'Civic', symbol: 'T' },
  { id: 'waste-routes', file: 'waste-routes.geojson', label: 'Waste routes', color: '#1b8347', group: 'Civic', symbol: 'WR' },
  { id: 'waste-zones', file: 'waste-zones.geojson', label: 'Waste zones', color: '#6dbdb2', group: 'Civic', symbol: 'WZ' },
  { id: 'waste-checkpoints', file: 'waste-checkpoints.geojson', label: 'Waste checkpoints', color: '#25a214', group: 'Civic', symbol: 'CP', labels: true },

  // ---- Stay ----
  { id: 'hotels', file: 'hotels.geojson', label: 'Hotels', color: '#930380', group: 'Stay', symbol: 'H' },
  { id: 'guest-houses', file: 'guest-houses.geojson', label: 'Guest houses', color: '#c72db1', group: 'Stay', symbol: 'GH' },
  { id: 'boys-hostels', file: 'boys-hostels.geojson', label: 'Boys hostels', color: '#9c548d', group: 'Stay', symbol: '♂' },
  { id: 'girls-hostels', file: 'girls-hostels.geojson', label: 'Girls hostels', color: '#bc79a3', group: 'Stay', symbol: '♀' },

  // ---- Shops ----
  { id: 'grocery-shops', file: 'grocery-shops.geojson', label: 'Grocery shops', color: '#6c5307', group: 'Shops', symbol: 'G' },
  { id: 'vegetable-markets', file: 'vegetable-markets.geojson', label: 'Vegetable markets', color: '#c57f4c', group: 'Shops', symbol: 'V' },
  { id: 'cloud-kitchens', file: 'cloud-kitchens.geojson', label: 'Cloud kitchens', color: '#8d7718', group: 'Shops', symbol: 'K' },
  { id: 'malls', file: 'malls.geojson', label: 'Malls', color: '#ee6f13', group: 'Shops', symbol: 'M' },
  { id: 'watch-stores', file: 'watch-stores.geojson', label: 'Watch & clock shops', color: '#aca267', group: 'Shops', symbol: 'W' },
]

export const DEFAULT_ACTIVE_LAYER_IDS = ['parking-zones', 'ghats']

export const VERIFIED = 'verified'

export const CAVEAT = {
  'locality-match': {
    text: 'Approximate — placed by locality name from its address, not a surveyed position.',
    tone: 'warn',
  },
  approximate: {
    text: 'Approximate — no locality match, placed near the city centre.',
    tone: 'warn',
  },
  indicative: {
    text: 'Indicative only — a marker for planned coverage, not a surveyed position. There is no camera at this point.',
    tone: 'warn',
  },
  LOW: {
    text: 'Low confidence — a neighbourhood-level position, usually shared with other hospitals in this source. Treat it as the area, not the building.',
    tone: 'warn',
  },
  MEDIUM: {
    text: 'Medium confidence — approximate, and often shared with other hospitals in this source.',
    tone: 'warn',
  },
  HIGH: {
    text: 'Highest confidence in this source, but not a surveyed position.',
    tone: 'note',
  },
}

export const LAYER_INFO = {
  'ghats': {
    summary: 'A polygon marking a bathing ghat or a riverside crowd holding area in the Kumbh mobility plan, or the centroid point repeating it.',
    provenance: 'From the NTKMA "Mobility plan Nashik" KMZ. Includes named ghats along the Godavari river.',
    caveat: '40 features are 20 areas each doubled as a centroid marker.',
    fieldNotes: { category: 'Ghat / Holding Area', source: 'Source File', sourceFolder: 'KMZ Folder Path' },
  },
  'parking-zones': {
    summary: 'The outline of designated parking plots from the Kumbh mobility and traffic management plan.',
    provenance: 'NTKMA parking and mobility plan KMZs.',
    caveat: 'Capacity figures exist on selected key zones.',
    fieldNotes: { Area: 'Area (Hectares)', Bus_Parking: 'Bus Parking Capacity', category: 'Feature Category' },
  },
  'ring-road': {
    summary: 'The outer bypass and inner ring road corridors designed to divert transit traffic around the sacred core.',
    provenance: 'Mobility plan Nashik (NTKMA).',
  },
  'congestion-points': {
    summary: 'High-density bottlenecks and critical junction intersections monitored during mela peak hours.',
    provenance: 'Nashik Traffic Police & NTKMA records.',
  },
  'cctv-cameras': {
    summary: 'Surveillance coverage points and monitoring grid mapped across the mela perimeter.',
    provenance: 'Smart City & NMC safety records.',
    notice: 'Includes both active cameras and planned density markers.',
  },
  'mandirs': {
    summary: 'Major temples, ashrams, and religious landmarks across Nashik and Trimbakeshwar.',
    provenance: 'OpenStreetMap and Kumbh pilgrim guides.',
  },
  'staging-areas': {
    summary: 'Designated staging grounds for shuttle buses and group arrivals.',
    provenance: 'Mobility Plan (NTKMA).',
  },
  'holding-areas': {
    summary: 'Crowd management holding pens and queue reservoirs to prevent stampedes near ghats.',
    provenance: 'NTKMA crowd safety plan.',
  },
  'emergency-routes': {
    summary: 'Priority green corridors kept clear for ambulances, fire tenders, and police response.',
    provenance: 'Nashik District Disaster Management Authority.',
  },
  'hospitals': {
    summary: 'Government civil hospitals, sub-district centers, and private trauma facilities.',
    provenance: 'NMC Health Dept & Health GIS datasets.',
  },
  'police-stations': {
    summary: 'Police commissionerate stations, chowkis, and temporary Kumbh assistance booths.',
    provenance: 'Nashik City Police.',
  },
  'ambulances': {
    summary: '108 emergency ambulance dispatch stations and field standby locations.',
    provenance: 'Maharashtra Emergency Medical Services.',
  },
  'fire-stations': {
    summary: 'Fire stations and standby water tender points.',
    provenance: 'NMC Fire Brigade.',
  },
  'public-toilets': {
    summary: 'Permanent municipal facilities and temporary mobile sanitation blocks.',
    provenance: 'NMC Swachh Bharat Geo-database.',
  },
  'petrol-pumps': {
    summary: 'Fuel stations with CNG/Petrol/Diesel facilities along major approach corridors.',
    provenance: 'City Logistics Directory.',
  },
}

export const OSM_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

export const ESRI_STREETS_STYLE = {
  version: 8,
  sources: {
    'esri-streets': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS',
    },
  },
  layers: [
    {
      id: 'esri-streets-layer',
      type: 'raster',
      source: 'esri-streets',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

export const SATELLITE_STYLE = {
  version: 8,
  sources: {
    'satellite-tiles': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, IGP',
    },
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

export const BASEMAPS = [
  {
    id: 'osm',
    label: 'Standard',
    light: OSM_STYLE,
    dark: OSM_STYLE,
  },
  {
    id: 'streets',
    label: 'Streets',
    light: ESRI_STREETS_STYLE,
    dark: ESRI_STREETS_STYLE,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    light: SATELLITE_STYLE,
    dark: SATELLITE_STYLE,
  },
  {
    id: 'positron',
    label: 'Positron',
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/dark',
  },
]

export const NAME_KEYS = ['name', 'Name', 'title', 'Title']

export function featureName(props) {
  if (!props) return ''
  for (const k of NAME_KEYS) {
    if (props[k] !== undefined && props[k] !== null && props[k] !== '') {
      return String(props[k])
    }
  }
  return ''
}

const dataCache = new Map()

export async function loadGeoJson(def) {
  if (dataCache.has(def.id)) return dataCache.get(def.id)
  try {
    const url = `${import.meta.env.BASE_URL}data/${def.file}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    dataCache.set(def.id, json)
    return json
  } catch (err) {
    console.warn(`[map] Dataset "${def.id}" failed to load:`, err)
    return null
  }
}

export async function loadAllDatasets() {
  const list = await Promise.all(
    LAYERS.map(async (def) => {
      const geojson = await loadGeoJson(def)
      if (!geojson?.features) return []
      return geojson.features.map((f) => ({
        ...f,
        properties: { ...f.properties, layer: def.label, layerId: def.id },
      }))
    })
  )
  const features = list.flat()
  return { type: 'FeatureCollection', features }
}

export function exportDataset(geojson, target, format = 'geojson') {
  if (!geojson) return
  let content = ''
  let mime = 'application/json'
  let ext = format

  if (format === 'geojson') {
    content = JSON.stringify(geojson, null, 2)
    mime = 'application/geo+json'
    ext = 'geojson'
  } else if (format === 'csv') {
    const keys = []
    for (const f of geojson.features || []) {
      for (const k of Object.keys(f.properties || {})) {
        if (!keys.includes(k)) keys.push(k)
      }
    }
    const header = [...keys, 'longitude', 'latitude']
    const rows = (geojson.features || []).map((f) => {
      const p = f.geometry?.type === 'Point' ? f.geometry.coordinates : null
      return [
        ...keys.map((k) => {
          const v = f.properties?.[k] ?? ''
          return `"${String(v).replace(/"/g, '""')}"`
        }),
        p ? p[0] : '',
        p ? p[1] : '',
      ].join(',')
    })
    content = `\uFEFF${[header.join(','), ...rows].join('\r\n')}\r\n`
    mime = 'text/csv'
    ext = 'csv'
  }

  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nashik-${target.id}.${ext}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
