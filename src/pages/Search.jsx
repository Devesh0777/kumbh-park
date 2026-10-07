import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getGhatPoints, getZones, searchSpots } from '@/api'
import { useApp } from '@/context/AppContext'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { NASHIK_CENTER } from '@/config/map'
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
  { id: 'instant', label: 'Instant book' },
  { id: 'onlyAvailable', label: 'Hiding full' },
  { id: 'openNow', label: 'Open now' },
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

  // Reads the zone/q deep link exactly once. The ref guard is what makes this
  // survive StrictMode's mount -> unmount -> mount cycle without patching a
  // second time and kicking off a duplicate fetch.
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

  // Drive the refetch off the filter *values*, not the `filters` object.
  // patchFilters always allocates a new object, so depending on identity
  // re-runs the search on every unrelated provider render.
  //
  // The query is debounced for the same reason: the input patches filters on
  // every keystroke, and each patch would otherwise cancel the in-flight
  // search and restart it, pinning the skeleton on for as long as typing
  // continues. The input itself stays controlled by the live value, so the
  // field still feels instant.
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

  // Stagger ties to a new result set, never to scrolling (spec §4).
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

  const zoneLabel = zones?.find((z) => z.id === filters.zone)?.name ?? 'All mela zones'

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
      title: 'Area updated',
      message: 'Showing the closest 20 spots around the map centre.',
    })
    reload()
  }

  return (
    <PageShell className="lg:pb-0">
      <div className="lg:grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(400px,44%)]">
        {/* ------------------------------- map pane ------------------------------ */}
        <section className="relative order-1 h-[44dvh] shrink-0 lg:order-2 lg:h-full">
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
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-text px-4 py-2 text-[12px] font-semibold text-white card-shadow transition-transform duration-200 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.97]"
            >
              <Icon name="refresh" size={14} />
              Search this area
            </button>
          </div>
        </section>

        {/* ------------------------------- list pane ------------------------------ */}
        <section className="order-2 flex min-h-0 flex-col lg:order-1 lg:h-full">
          <div className="sticky top-0 z-[500] border-b border-line bg-bg/94 pt-safe backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2.5 transition-transform duration-200 [transition-timing-function:var(--ease-out-expo)] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 active:scale-[1.02]">
                <Icon name="search" size={17} className="shrink-0 text-muted" />
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
                  placeholder="Where are you headed?"
                  className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-muted/70 focus:outline-none"
                />
                {filters.q && (
                  <button
                    type="button"
                    onClick={() => patchFilters({ q: '' })}
                    aria-label="Clear search"
                    className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-sunken"
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                aria-label="Filters"
                className="relative grid size-11 shrink-0 place-items-center rounded-full bg-text text-white transition-transform duration-200 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.97]"
              >
                <Icon name="sliders" size={19} />
                {activeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white ring-2 ring-bg">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
              <Chip active={filters.zone !== 'all'} onClick={() => setFilterOpen(true)} icon={<Icon name="pin" size={14} />}>
                {zoneLabel}
              </Chip>
              {QUICK_FILTERS.map((item) => {
                const active =
                  ['instant', 'onlyAvailable', 'openNow'].includes(item.id)
                    ? filters[item.id]
                    : filters.features.includes(item.id === 'gated' ? 'gate' : item.id)
                return (
                  <Chip key={item.id} active={Boolean(active)} onClick={() => toggleQuick(item.id)}>
                    {item.label}
                  </Chip>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[13px] font-semibold">
              {loading ? 'Finding spots…' : `${spots?.length ?? 0} spots`}
              <span className="ml-1.5 font-normal text-muted">· {zoneLabel}</span>
            </p>
            {spots?.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="text-[12px] font-semibold text-accent"
              >
                Sort & filters
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-24 lg:pb-8">
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
                title="No spots match these filters"
                message="Ramkund fills by 7 am on mela days. Try Trimbakeshwar, or relax the filters."
                action={
                  <Button
                    onClick={() =>
                      patchFilters({ features: [], onlyAvailable: false, instant: false, maxPrice: null })
                    }
                  >
                    Relax filters
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
              <p className="py-6 text-center text-[12px] text-muted">
                That is every spot matching your filters.{' '}
                <button
                  type="button"
                  className="font-semibold text-accent"
                  onClick={() => navigate('/host/new')}
                >
                  List your parking?
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
