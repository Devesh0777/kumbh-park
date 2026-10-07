import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  BASEMAPS,
  CAVEAT,
  DEFAULT_ACTIVE_LAYER_IDS,
  LAYERS,
  LAYER_INFO,
  VERIFIED,
  featureName,
  loadGeoJson,
} from '@/map/nashikMonitorData'
import { cn } from '@/lib/cn'
import Icon from '@/components/ui/Icon'

const NASHIK_CENTER_LNG_LAT = [73.7898, 19.9975]
const TERRAIN_SOURCE = 'nm-terrain-dem'
const HILLSHADE_LAYER = 'nm-terrain-hillshade'

const HIDDEN_POPUP_KEYS = new Set([
  'locationConfidence',
  'geocodeConfidence',
  'locationSource',
  'role',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'fill',
  'fill-opacity',
  'layer',
  'layerId',
])

function parseToLngLat(coords) {
  if (!coords) return NASHIK_CENTER_LNG_LAT
  if (Array.isArray(coords)) {
    const c0 = Number(coords[0])
    const c1 = Number(coords[1])
    if (isNaN(c0) || isNaN(c1)) return NASHIK_CENTER_LNG_LAT
    // If first element is > 50, it's longitude [lng, lat]
    if (c0 > 50) return [c0, c1]
    // Otherwise it's latitude [lat, lng] -> convert to [lng, lat]
    return [c1, c0]
  }
  if (coords.lng !== undefined && coords.lat !== undefined) {
    return [Number(coords.lng), Number(coords.lat)]
  }
  return NASHIK_CENTER_LNG_LAT
}

export default function KumbhMap({
  spots = [],
  center,
  zoom = 12,
  focus = null,
  selectedId = null,
  overlayIds = DEFAULT_ACTIVE_LAYER_IDS,
  onSelect,
  onMapClick,
  onReady,
  interactive = true,
  className,
  onOpenLayers,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)
  const spotMarkersRef = useRef(new Map())
  const loadedSourcesRef = useRef(new Set())
  const activeNoticeRef = useRef(new Set())
  const handlersRef = useRef({ onSelect, onMapClick, onReady })

  const [basemap, setBasemap] = useState('osm')
  const [terrainOn, setTerrainOn] = useState(false)
  const [mapTheme, setMapTheme] = useState('light')
  const [notice, setNotice] = useState(null)
  const [isMapReady, setIsMapReady] = useState(false)

  useEffect(() => {
    handlersRef.current = { onSelect, onMapClick, onReady }
  })

  const activeOverlaySet = useMemo(() => new Set(overlayIds), [overlayIds])

  // Style definition calculation
  const currentStyleDef = useMemo(() => {
    const def = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0]
    return mapTheme === 'dark' ? def.dark : def.light
  }, [basemap, mapTheme])

  // Initialize MapLibre GL
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialLngLat = parseToLngLat(center)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: currentStyleDef,
      center: initialLngLat,
      zoom: zoom,
      maxPitch: 80,
      fadeDuration: 0,
      maxParallelImageRequests: 32,
      renderWorldCopies: false,
      trackResize: true,
      attributionControl: { compact: true },
    })

    mapRef.current = map

    // If style fails, automatically fall back to standard OSM style
    map.on('error', (e) => {
      if (e.error && (e.error.status === 404 || e.error.status === 403 || e.error.message?.includes('Failed to fetch'))) {
        console.warn('[MapLibre] Style load issue, falling back to OSM raster:', e.error)
        try {
          map.setStyle(BASEMAPS[0].light)
        } catch (_) {}
      }
    })

    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right')
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left')
    }

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '340px' })
    popupRef.current = popup

    const handleReady = () => {
      setIsMapReady(true)
      map.resize()
      handlersRef.current.onReady?.(map)
    }

    map.on('load', handleReady)
    map.on('style.load', () => {
      setIsMapReady(true)
      syncLayers()
    })

    // Click handler for both data features and canvas clicks
    map.on('click', (e) => {
      const lat = e.lngLat.lat
      const lng = e.lngLat.lng
      const clickCoords = [lat, lng]
      clickCoords.lat = lat
      clickCoords.lng = lng

      handlersRef.current.onMapClick?.(clickCoords)

      // Query data layers for click popups
      const pickableLayers = LAYERS.flatMap((l) => [
        `${l.id}-point`,
        `${l.id}-circle`,
        `${l.id}-fill`,
        `${l.id}-line`,
      ]).filter((id) => map.getLayer(id))

      if (!pickableLayers.length) return

      const hits = map.queryRenderedFeatures(e.point, { layers: pickableLayers })
      if (!hits || !hits.length) return

      const hit = hits[0]
      const sourceId = hit.source
      const def = LAYERS.find((l) => l.id === sourceId)
      if (!def) return

      const props = hit.properties || {}
      const info = LAYER_INFO[def.id]
      const title = featureName(props) || def.label
      const confidence = props.locationConfidence ?? props.geocodeConfidence
      const caveat = typeof confidence === 'string' ? CAVEAT[confidence] : null

      const popupNode = document.createElement('div')
      popupNode.className = 'nm-popup'

      // Title
      const h3 = document.createElement('h3')
      h3.className = 'nm-popup-title'
      h3.textContent = title
      popupNode.appendChild(h3)

      // Layer badge
      const layerBadge = document.createElement('div')
      layerBadge.className = 'nm-popup-layer'
      layerBadge.innerHTML = `<span class="map-layer-swatch" style="background:${def.color}"></span><span>${def.group} · ${def.label}</span>`
      popupNode.appendChild(layerBadge)

      // Summary
      if (info?.summary) {
        const sumEl = document.createElement('div')
        sumEl.className = 'nm-popup-summary'
        sumEl.textContent = info.summary
        popupNode.appendChild(sumEl)
      }

      // Confidence
      if (confidence === VERIFIED) {
        const verEl = document.createElement('div')
        verEl.className = 'nm-popup-verified'
        verEl.innerHTML = '✓ Verified position'
        popupNode.appendChild(verEl)
      } else if (caveat) {
        const cavEl = document.createElement('div')
        cavEl.className = caveat.tone === 'warn' ? 'nm-popup-warn' : 'nm-popup-note'
        cavEl.textContent = caveat.text
        popupNode.appendChild(cavEl)
      } else if (info?.caveat) {
        const cavEl = document.createElement('div')
        cavEl.className = 'nm-popup-note'
        cavEl.textContent = info.caveat
        popupNode.appendChild(cavEl)
      }

      // Attributes table
      const entries = Object.entries(props).filter(
        ([k, v]) => v !== null && v !== undefined && v !== '' && !HIDDEN_POPUP_KEYS.has(k)
      )

      if (entries.length > 0) {
        const dl = document.createElement('dl')
        dl.className = 'nm-popup-table'
        for (const [key, val] of entries.slice(0, 8)) {
          const label = info?.fieldNotes?.[key] || key
          const dt = document.createElement('dt')
          dt.textContent = label
          dt.title = key
          const dd = document.createElement('dd')
          dd.textContent = String(val)
          dl.appendChild(dt)
          dl.appendChild(dd)
        }
        popupNode.appendChild(dl)
      }

      // Provenance
      if (info?.provenance) {
        const srcEl = document.createElement('div')
        srcEl.className = 'nm-popup-source'
        srcEl.textContent = `Source: ${info.provenance}`
        popupNode.appendChild(srcEl)
      }

      popup.setLngLat(e.lngLat).setDOMContent(popupNode).addTo(map)
    })

    // Pointer cursor on hover
    map.on('mousemove', (e) => {
      const pickableLayers = LAYERS.flatMap((l) => [
        `${l.id}-point`,
        `${l.id}-circle`,
        `${l.id}-fill`,
        `${l.id}-line`,
      ]).filter((id) => map.getLayer(id))

      if (!pickableLayers.length) {
        map.getCanvas().style.cursor = ''
        return
      }

      const hits = map.queryRenderedFeatures(e.point, { layers: pickableLayers })
      map.getCanvas().style.cursor = hits.length ? 'pointer' : ''
    })

    // Resize observer & initial invalidation
    const timer = setTimeout(() => map.resize(), 100)
    const raf = requestAnimationFrame(() => map.resize())

    const observer = new ResizeObserver(() => {
      map.resize()
    })
    observer.observe(containerRef.current)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      observer.disconnect()
      spotMarkersRef.current.forEach((m) => m.remove())
      spotMarkersRef.current.clear()
      map.remove()
      mapRef.current = null
      loadedSourcesRef.current.clear()
    }
  }, [])

  // Sync style changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    loadedSourcesRef.current.clear()
    try {
      map.setStyle(currentStyleDef)
      map.once('style.load', () => {
        syncTerrain()
        syncLayers()
      })
    } catch (err) {
      console.warn('[MapLibre] setStyle error:', err)
    }
  }, [currentStyleDef])

  // Sync 3D Terrain
  const syncTerrain = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    try {
      if (!terrainOn) {
        map.setTerrain(null)
        if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER)
        return
      }

      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 13,
          attribution: 'Elevation © Tilezen',
        })
      }

      if (!map.getLayer(HILLSHADE_LAYER)) {
        map.addLayer({
          id: HILLSHADE_LAYER,
          type: 'hillshade',
          source: TERRAIN_SOURCE,
          paint: {
            'hillshade-exaggeration': 0.35,
            'hillshade-shadow-color': mapTheme === 'dark' ? '#000000' : '#4a3c33',
            'hillshade-highlight-color': mapTheme === 'dark' ? '#5c4e42' : '#ffffff',
          },
        })
      }

      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.25 })
    } catch (err) {
      console.warn('[map] 3D Terrain sync error:', err)
    }
  }, [terrainOn, mapTheme])

  useEffect(() => {
    syncTerrain()
    const map = mapRef.current
    if (map) {
      map.easeTo({ pitch: terrainOn ? 55 : 0, duration: 600 })
    }
  }, [terrainOn, syncTerrain])

  // Mount GeoJSON layers
  const mountLayer = useCallback((def, geojson) => {
    const map = mapRef.current
    if (!map || !geojson || map.getSource(def.id)) return

    try {
      map.addSource(def.id, { type: 'geojson', data: geojson })
      loadedSourcesRef.current.add(def.id)

      // 1. Polygon Fill
      map.addLayer({
        id: `${def.id}-fill`,
        type: 'fill',
        source: def.id,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': ['case', ['has', 'fill'], ['to-string', ['get', 'fill']], def.color],
          'fill-opacity': ['case', ['has', 'fill-opacity'], ['to-number', ['get', 'fill-opacity']], 0.2],
        },
      })

      // 2. Line Stroke
      map.addLayer({
        id: `${def.id}-line`,
        type: 'line',
        source: def.id,
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['has', 'stroke'], ['to-string', ['get', 'stroke']], def.color],
          'line-width': ['case', ['has', 'stroke-width'], ['to-number', ['get', 'stroke-width']], 2.5],
          'line-opacity': ['case', ['has', 'stroke-opacity'], ['to-number', ['get', 'stroke-opacity']], 0.85],
        },
      })

      // 3. Circle Marker for Points (Guaranteed visible)
      map.addLayer({
        id: `${def.id}-circle`,
        type: 'circle',
        source: def.id,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6.5,
          'circle-color': def.color,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      })
    } catch (err) {
      console.warn(`[map] mountLayer error for "${def.id}":`, err)
    }
  }, [])

  // Sync active layers
  const syncLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    for (const def of LAYERS) {
      const isWanted = activeOverlaySet.has(def.id)

      if (isWanted) {
        if (LAYER_INFO[def.id]?.notice && !activeNoticeRef.current.has(def.id)) {
          activeNoticeRef.current.add(def.id)
          setNotice({ label: def.label, text: LAYER_INFO[def.id].notice })
          setTimeout(() => setNotice((n) => (n?.label === def.label ? null : n)), 8000)
        }

        if (!map.getSource(def.id)) {
          loadGeoJson(def).then((geojson) => {
            if (geojson && activeOverlaySet.has(def.id) && mapRef.current) {
              mountLayer(def, geojson)
            }
          })
        } else {
          for (const sub of [`${def.id}-fill`, `${def.id}-line`, `${def.id}-circle`]) {
            if (map.getLayer(sub)) map.setLayoutProperty(sub, 'visibility', 'visible')
          }
        }
      } else {
        for (const sub of [`${def.id}-fill`, `${def.id}-line`, `${def.id}-circle`]) {
          if (map.getLayer(sub)) map.setLayoutProperty(sub, 'visibility', 'none')
        }
      }
    }
  }, [activeOverlaySet, mountLayer])

  useEffect(() => {
    syncLayers()
  }, [syncLayers])

  // Sync Private Parking Spot Price Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const existingMarkers = spotMarkersRef.current
    const currentSpotIds = new Set(spots.map((s) => s.id))

    // Remove deleted spots
    for (const [id, marker] of existingMarkers) {
      if (!currentSpotIds.has(id)) {
        marker.remove()
        existingMarkers.delete(id)
      }
    }

    // Add or update spots
    for (const spot of spots) {
      const lngLat = parseToLngLat(spot.latlng)
      const isSelected = spot.id === selectedId
      const tone = spot.availability === 'full' ? 'full' : spot.availability === 'filling' ? 'filling' : 'available'

      let marker = existingMarkers.get(spot.id)

      if (!marker) {
        const el = document.createElement('div')
        el.className = 'nm-spot-marker-container'
        el.setAttribute('data-spot-id', spot.id)

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          handlersRef.current.onSelect?.(spot)
        })

        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(lngLat)
          .addTo(map)

        existingMarkers.set(spot.id, marker)
      } else {
        marker.setLngLat(lngLat)
      }

      // Update inner element
      const el = marker.getElement()
      el.innerHTML = `
        <div class="pin pin--${tone} ${isSelected ? 'pin--selected ring-2 ring-accent scale-110 shadow-xl' : ''}" style="cursor:pointer;">
          ₹${spot.from ?? spot.priceHour}
        </div>
      `
    }
  }, [spots, selectedId])

  // Focus effect
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const targetLngLat = parseToLngLat(focus.latlng)
    map.flyTo({
      center: targetLngLat,
      zoom: focus.zoom ?? Math.max(map.getZoom(), 14),
      duration: 700,
    })
  }, [focus])

  // Selected spot panning
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const spot = spots.find((s) => s.id === selectedId)
    if (spot) {
      const lngLat = parseToLngLat(spot.latlng)
      map.easeTo({
        center: lngLat,
        duration: 500,
      })
    }
  }, [selectedId, spots])

  return (
    <div className={cn('relative size-full min-h-[300px] overflow-hidden bg-surface-sunken', className)}>
      {/* MapLibre Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 size-full" />

      {/* Floating Nashik Monitor Map Controls Bar */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2">
        {/* Basemap Picker */}
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface/95 p-1 card-shadow backdrop-blur-md">
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBasemap(b.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold transition-all',
                basemap === b.id
                  ? 'bg-text text-white shadow-sm'
                  : 'text-muted hover:bg-surface-sunken hover:text-text'
              )}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* 3D Terrain Toggle */}
        <button
          type="button"
          onClick={() => setTerrainOn((prev) => !prev)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-bold card-shadow backdrop-blur-md transition-all active:scale-95',
            terrainOn
              ? 'bg-accent text-white border-accent shadow-md'
              : 'bg-surface/95 text-text hover:bg-surface-sunken'
          )}
        >
          <span>⛰️ 3D Terrain</span>
          <span className={cn('size-1.5 rounded-full', terrainOn ? 'bg-white animate-pulse' : 'bg-muted')} />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={() => setMapTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          className="grid size-8 place-items-center rounded-full border border-line bg-surface/95 text-muted card-shadow backdrop-blur-md transition-transform hover:scale-105 active:scale-95 hover:text-text"
          title={mapTheme === 'dark' ? 'Switch to light map' : 'Switch to dark map'}
          aria-label="Toggle map theme"
        >
          <span>{mapTheme === 'dark' ? '☀' : '☾'}</span>
        </button>

        {/* Open Layers Button */}
        {onOpenLayers && (
          <button
            type="button"
            onClick={onOpenLayers}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-surface/95 px-3 py-1.5 text-[11px] font-bold text-accent card-shadow backdrop-blur-md transition-all hover:bg-accent hover:text-white active:scale-95"
          >
            <Icon name="sliders" size={13} />
            <span>Nashik Layers ({overlayIds.length})</span>
          </button>
        )}
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="nm-notice-banner absolute top-14 left-3 z-[450] max-w-sm rounded-2xl border border-warning/30 bg-surface p-3.5 card-shadow backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-warning">
              <Icon name="checkCircle" size={14} />
              <span>{notice.label} Dataset Note</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-muted hover:text-text"
              aria-label="Dismiss notice"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{notice.text}</p>
        </div>
      )}
    </div>
  )
}
