import { useMemo, useState } from 'react'
import {
  DEFAULT_ACTIVE_LAYER_IDS,
  GROUPS,
  LAYERS,
  exportDataset,
  loadAllDatasets,
  loadGeoJson,
} from '@/map/nashikMonitorData'
import { cn } from '@/lib/cn'
import Icon from '@/components/ui/Icon'

export const DEFAULT_OVERLAY_IDS = DEFAULT_ACTIVE_LAYER_IDS
export { DEFAULT_ACTIVE_LAYER_IDS }

export default function MapLayerToggle({
  active = DEFAULT_ACTIVE_LAYER_IDS,
  onChange,
  className,
  open,
  onClose,
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)
  const [downloadingAll, setDownloadingAll] = useState(false)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? (val) => (!val ? onClose?.() : null) : setInternalOpen

  const activeSet = useMemo(() => new Set(active), [active])

  const filteredLayers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return LAYERS
    return LAYERS.filter(
      (l) => l.label.toLowerCase().includes(q) || l.group.toLowerCase().includes(q)
    )
  }, [search])

  const grouped = useMemo(() => {
    return GROUPS.map((group) => ({
      group,
      layers: filteredLayers.filter((l) => l.group === group),
    })).filter((g) => g.layers.length > 0)
  }, [filteredLayers])

  const toggleLayer = (id) => {
    if (activeSet.has(id)) {
      onChange(active.filter((item) => item !== id))
    } else {
      onChange([...active, id])
    }
  }

  const toggleGroup = (groupLayers, enable) => {
    const groupIds = groupLayers.map((l) => l.id)
    if (enable) {
      const next = new Set([...active, ...groupIds])
      onChange(Array.from(next))
    } else {
      onChange(active.filter((id) => !groupIds.includes(id)))
    }
  }

  const handleDownloadLayer = async (e, def, format = 'geojson') => {
    e.stopPropagation()
    setDownloadingId(def.id)
    try {
      const geojson = await loadGeoJson(def)
      if (geojson) {
        exportDataset(geojson, def, format)
      }
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadAll = async () => {
    setDownloadingAll(true)
    try {
      const allGeojson = await loadAllDatasets()
      if (allGeojson) {
        exportDataset(allGeojson, { id: 'all-datasets', label: 'Nashik Monitor All' }, 'geojson')
      }
    } catch (err) {
      console.error('Download all failed:', err)
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className={cn('absolute bottom-3 left-3 z-[500]', className)}>
      {isOpen ? (
        <div className="flex w-80 max-w-[calc(100vw-24px)] flex-col rounded-2xl border border-line bg-surface/98 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name="layers" size={14} />
              </span>
              <div>
                <p className="text-[13px] font-bold text-text">Nashik Monitor Layers</p>
                <p className="text-[10px] text-muted">
                  {active.length} of {LAYERS.length} datasets active
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-sunken hover:text-text"
              aria-label="Close layers"
            >
              <Icon name="x" size={14} />
            </button>
          </div>

          {/* Search input */}
          <div className="border-b border-line px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-[12px]">
              <Icon name="search" size={13} className="text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search 36 city datasets..."
                className="w-full bg-transparent placeholder:text-muted/60 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-muted hover:text-text">
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Layer list */}
          <div className="max-h-72 overflow-y-auto overscroll-contain px-3 py-2 space-y-3 no-scrollbar">
            {grouped.map(({ group, layers }) => {
              const allInGroupActive = layers.every((l) => activeSet.has(l.id))
              return (
                <div key={group} className="space-y-1">
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
                      {group} ({layers.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(layers, !allInGroupActive)}
                      className="text-[10px] font-semibold text-accent hover:underline"
                    >
                      {allInGroupActive ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    {layers.map((layer) => {
                      const isOn = activeSet.has(layer.id)
                      const isDownloading = downloadingId === layer.id

                      return (
                        <div
                          key={layer.id}
                          onClick={() => toggleLayer(layer.id)}
                          className={cn(
                            'group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors',
                            isOn ? 'bg-surface-sunken/70' : 'hover:bg-surface-sunken/40'
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => toggleLayer(layer.id)}
                              className="size-3.5 accent-accent"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span
                              className="map-layer-swatch"
                              style={{ background: layer.color }}
                              title={layer.color}
                            />
                            <span
                              className={cn(
                                'truncate text-[12px] font-medium',
                                isOn ? 'text-text font-semibold' : 'text-muted'
                              )}
                            >
                              {layer.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="rounded bg-surface px-1 py-0.5 text-[9px] font-bold text-muted border border-line/60">
                              {layer.symbol}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadLayer(e, layer, 'geojson')}
                              disabled={isDownloading}
                              title={`Download ${layer.label} GeoJSON`}
                              className="grid size-6 place-items-center rounded text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                            >
                              <Icon name="download" size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-line bg-surface-sunken/50 p-2.5 text-[11px]">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_ACTIVE_LAYER_IDS)}
              className="font-medium text-muted hover:text-text"
            >
              Reset defaults
            </button>

            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="inline-flex items-center gap-1 rounded-lg bg-text px-2.5 py-1 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Icon name="download" size={12} />
              <span>{downloadingAll ? 'Preparing...' : 'Download all 36'}</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3.5 py-2 text-[12px] font-bold text-text card-shadow backdrop-blur-md transition-all hover:border-accent/40 hover:bg-surface active:scale-95"
        >
          <Icon name="layers" size={15} className="text-accent" />
          <span>Nashik Monitor Layers</span>
          {active.length > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
              {active.length}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
