import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getGhatPoints, getZones, searchSpots } from '@/api'
import { useApp } from '@/context/AppContext'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { NASHIK_CENTER } from '@/config/map'
import { cn } from '@/lib/cn'
import { PageShell } from '@/components/layout/PageShell'
import KumbhMap from '@/components/map/KumbhMap'
import MapLayerToggle, { DEFAULT_OVERLAY_IDS } from '@/components/map/MapLayerToggle'
import FilterSheet from '@/components/parking/FilterSheet'
import ParkingCard from '@/components/parking/ParkingCard'
import ParkingCardSkeleton from '@/components/parking/ParkingCardSkeleton'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'

const QUICK_FILTERS = [
  { id: 'instant', label: 'Instant QR' },
  { id: 'onlyAvailable', label: 'Open Bays Only' },
  { id: 'openNow', label: 'Open Now' },
  { id: 'covered', label: 'Covered' },
  { id: 'gated', label: 'Gated' },
]

export default function Search() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { filters, patchFilters } = useApp()

  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [stagger, setStagger] = useState(false)
  const [overlayIds, setOverlayIds] = useState(DEFAULT_OVERLAY_IDS)
  const cardRefs = useRef(new Map())

  // Reads the zone/q deep link exactly once
  const appliedDeepLink = useRef(false)
  useEffect(() => {
    if (appliedDeepLink.current) return
    appliedDeepLink.current = true
    const zone = params.get('zone')
    const q = params.get('q')
    if (zone || q) patchFilters({ zone: zone ?? 'all', q: q ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: zones } = useAsync(() => getZones(), [])
  const { data: ghats } = useAsync(() => getGhatPoints(), [])

  const debouncedQuery = useDebouncedValue(filters.q)

  const filterKey = [
    filters.zone,
    debouncedQuery,
    filters.vehicle,
    filters.plan,
    filters.sort,
    filters.maxPrice,
    filters.features.join(','),
    filters.instant,
    filters.onlyAvailable,
    filters.openNow,
  ].join('|')

  const { data: spots, loading, error, reload } = useAsync(
    () => searchSpots({ ...filters, q: debouncedQuery }),
    [filterKey],
  )

  useEffect(() => {
    if (!spots) return
    const timer = setTimeout(() => setStagger(true), 40)
    return () => clearTimeout(timer)
  }, [spots])

  const activeCount = useMemo(() => {
    let count = 0
    if (filters.zone !== 'all') count += 1
    if (filters.vehicle !== 'all') count += 1
    if (filters.maxPrice != null) count += 1
    count += filters.features.length
    if (filters.instant) count += 1
    if (filters.onlyAvailable) count += 1
    if (!filters.openNow) count += 1
    return count
  }, [filters])

  const zoneLabel = zones?.find((z) => z.id === filters.zone)?.name ?? 'All Mela Sectors'

  const focus = useMemo(() => {
    if (filters.zone === 'all') return null
    const zone = zones?.find((z) => z.id === filters.zone)
    return { latlng: zone?.latlng ?? NASHIK_CENTER, zoom: 14 }
  }, [filters.zone, zones])

  const toggleQuick = (id) => {
    if (id === 'instant' || id === 'onlyAvailable' || id === 'openNow') {
      patchFilters({ [id]: !filters[id] })
      return
    }
    const featureId = id === 'gated' ? 'gate' : id
    patchFilters({
      features: filters.features.includes(featureId)
        ? filters.features.filter((f) => f !== featureId)
        : [...filters.features, featureId],
    })
  }

  const onMarkerSelect = (spot) => {
    setSelectedId(spot.id)
    const node = cardRefs.current.get(spot.id)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const searchThisArea = () => {
    toast.push({
      tone: 'info',
      title: 'Sector Updated',
      message: 'Showing verified parking spots around current map center.',
    })
    reload()
  }

  return (
    <PageShell className="lg:pb-0">
      <div className="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(420px,46%)]">
        {/* =========================================================================
            MAP TELEMETRY PANE (DOMINANT RIGHT COLUMN ON DESKTOP)
        ========================================================================= */}
        <section className="relative order-1 h-[45dvh] shrink-0 lg:order-2 lg:h-full border-b lg:border-b-0 lg:border-l border-[#E8E1D6]">
          <KumbhMap
            spots={spots ?? []}
            ghatPoints={ghats ?? []}
            overlayIds={overlayIds}
            center={NASHIK_CENTER}
            zoom={filters.zone === 'all' ? 12 : 14}
            focus={focus}
            selectedId={selectedId}
            onSelect={onMarkerSelect}
            onOpenLayers={() => setFilterOpen(false)}
          />
          <MapLayerToggle active={overlayIds} onChange={setOverlayIds} />

          <div className="absolute inset-x-0 bottom-3 flex justify-center px-4 pointer-events-none">
            <button
              type="button"
              onClick={searchThisArea}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#111923] px-4 py-2 text-[12px] font-bold text-white shadow-xl hover:bg-[#005A36] transition-all active:scale-95 border border-white/20"
            >
              <Icon name="refresh" size={14} />
              <span>Search This Sector Area</span>
            </button>
          </div>
        </section>

        {/* =========================================================================
            SIGNAGE LISTING PANE (LEFT COLUMN ON DESKTOP)
        ========================================================================= */}
        <section className="order-2 flex min-h-0 flex-col lg:order-1 lg:h-full bg-[#FAF7F2]">
          {/* Top Search & Filter Bar */}
          <div className="sticky top-0 z-[500] border-b border-[#E8E1D6] bg-[#FAF7F2]/98 pt-safe backdrop-blur-md">
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E8E1D6] bg-white px-3 py-2 transition-all focus-within:border-[#005A36] focus-within:ring-2 focus-within:ring-[#005A36]/20 shadow-2xs">
                <Icon name="search" size={15} className="shrink-0 text-[#005A36]" />
                <input
                  value={filters.q}
                  onChange={(event) => {
                    patchFilters({ q: event.target.value })
                    setParams((current) => {
                      const next = new URLSearchParams(current)
                      if (event.target.value) next.set('q', event.target.value)
                      else next.delete('q')
                      return next
                    })
                  }}
                  placeholder="Where are you headed? (e.g. Ramkund, Panchavati...)"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] font-bold text-[#111B27] placeholder:text-[#6B6B6B]/70 focus:outline-none"
                />
                {filters.q && (
                  <button
                    type="button"
                    onClick={() => patchFilters({ q: '' })}
                    aria-label="Clear search"
                    className="grid size-5 shrink-0 place-items-center rounded-full text-[#6B6B6B] hover:bg-[#F2EDE4]"
                  >
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                aria-label="Filters"
                className="relative grid size-9.5 shrink-0 place-items-center rounded-xl bg-[#006B4F] text-white transition-transform active:scale-95 shadow-xs border border-white/30 cursor-pointer"
              >
                <Icon name="sliders" size={16} />
                {activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-[#E9A83A] text-[9.5px] font-mono font-black text-[#17212B] ring-1.5 ring-white">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Filter Rails */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 pb-2.5">
              <Chip
                active={filters.zone !== 'all'}
                onClick={() => setFilterOpen(true)}
                icon={<Icon name="pin" size={12} />}
                className={cn(
                  'font-bold text-[11.5px] py-1.5 px-3 rounded-lg transition-all',
                  filters.zone !== 'all' ? 'bg-[#006B4F] border-[#006B4F] text-white' : 'bg-white border-[#E2DDD3] text-[#17212B]',
                )}
              >
                {zoneLabel}
              </Chip>
              {QUICK_FILTERS.map((item) => {
                const active =
                  ['instant', 'onlyAvailable', 'openNow'].includes(item.id)
                    ? filters[item.id]
                    : filters.features.includes(item.id === 'gated' ? 'gate' : item.id)
                return (
                  <Chip
                    key={item.id}
                    active={Boolean(active)}
                    onClick={() => toggleQuick(item.id)}
                    className={cn(
                      'font-bold text-[11.5px] py-1.5 px-3 rounded-lg transition-all',
                      active ? 'bg-[#006B4F] border-[#006B4F] text-white' : 'bg-white border-[#E2DDD3] text-[#17212B]',
                    )}
                  >
                    {item.label}
                  </Chip>
                )
              })}
            </div>
          </div>

          {/* Operational Header with Listing Count & Sort Access */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-[#E2DDD3] bg-[#F7F3EA]">
            <div>
              <span className="text-[11.5px] font-mono font-black uppercase text-[#17212B] block leading-tight">
                {loading ? 'CALIBRATING SPOTS…' : `${spots?.length ?? 0} PARKING SPOTS`}
              </span>
              <span className="text-[9.5px] font-bold text-[#006B4F] uppercase tracking-wider block">
                NASHIK • KUMBH 2027
              </span>
            </div>

            {spots?.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="text-[11.5px] font-bold text-[#E9A83A] hover:underline cursor-pointer"
              >
                SORT & FILTERS →
              </button>
            )}
          </div>

          {/* Compact List of Distinct Kumbh Park Parking Signs */}
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 pb-24 lg:pb-8">
            {loading && (
              <>
                {[0, 1, 2, 3].map((key) => (
                  <ParkingCardSkeleton key={key} />
                ))}
              </>
            )}

            {error && <ErrorState message={error.friendlyMessage} onRetry={reload} />}

            {!loading && !error && spots?.length === 0 && (
              <EmptyState
                icon="pin"
                title="No parking signs match these filters"
                message="Ramkund fills early during Shahi Snan dates. Try Trimbakeshwar or relax your filter settings."
                action={
                  <Button
                    onClick={() =>
                      patchFilters({ features: [], onlyAvailable: false, instant: false, maxPrice: null })
                    }
                  >
                    Reset Filter Settings
                  </Button>
                }
              />
            )}

            {(spots ?? []).map((spot, index) => (
              <div
                key={spot.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(spot.id, node)
                  else cardRefs.current.delete(spot.id)
                }}
                onMouseEnter={() => setSelectedId(spot.id)}
              >
                <ParkingCard
                  spot={spot}
                  plan={filters.plan}
                  selected={selectedId === spot.id}
                  index={index}
                  animate={stagger}
                  onSelect={() => setSelectedId(spot.id)}
                />
              </div>
            ))}

            {!loading && spots?.length > 0 && (
              <p className="py-6 text-center text-[12px] text-[#6B6B6B]">
                You have reached the end of verified spots for this sector.{' '}
                <button
                  type="button"
                  className="font-bold text-[#D9483B] hover:underline ml-1 cursor-pointer"
                  onClick={() => navigate('/host/new')}
                >
                  List your compound?
                </button>
              </p>
            )}
          </div>
        </section>
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        resultCount={spots?.length ?? 0}
        zones={zones ?? []}
        sort={filters.sort}
        onSort={(sort) => patchFilters({ sort })}
      />
    </PageShell>
  )
}
