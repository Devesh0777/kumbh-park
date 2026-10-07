import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getZones, searchSpots } from '@/api'
import { money, metres } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { useReveal } from '@/hooks/useReveal'
import { useApp } from '@/context/AppContext'
import { PageShell } from '@/components/layout/PageShell'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import Photo from '@/components/ui/Photo'
import StatusPill from '@/components/ui/StatusPill'
import { Rating, VerifiedBadge } from '@/components/ui/Bits'
import { Skeleton } from '@/components/ui/Skeleton'
import { AVAILABILITY } from '@/lib/status'

const POPULAR_SEARCHES = [
  { label: 'Ramkund', zone: 'ramkund', q: '' },
  { label: 'Panchavati Ghat', zone: 'panchavati', q: 'Ghat' },
  { label: 'Tapovan Ashram', zone: 'tapovan', q: 'Tapovan' },
  { label: 'Trimbakeshwar', zone: 'trimbakeshwar', q: '' },
  { label: 'Nashik Road Stn', zone: 'nashik-road', q: '' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: 'search',
    title: 'Find & Pre-Book',
    body: 'Select your vehicle type, target Ghat, and arrival time. Reserve verified private parking before you reach Nashik.',
  },
  {
    step: '02',
    icon: 'pin',
    title: 'Bypass Mela Jams',
    body: 'Get turn-by-turn navigation through verified bypass routes that avoid police barricades and restricted pedestrian zones.',
  },
  {
    step: '03',
    icon: 'qr',
    title: 'Instant QR Entry',
    body: 'Flash your digital gate pass at the plot entrance. Host marks you in, and you walk straight to your holy dip.',
  },
]

const TRUST_METRICS = [
  { icon: 'shield', title: '100% ID-Verified', desc: 'Every plot & caretaker pre-inspected' },
  { icon: 'bolt', title: 'Instant Confirmation', desc: 'Guaranteed reserved spot upon booking' },
  { icon: 'clock', title: '2–7 Min Walk to Ghats', desc: 'Prime spots closest to holy snan kunds' },
  { icon: 'wallet', title: 'Zero Surge Rates', desc: 'Transparent UPI & cash on arrival' },
]

const FAQS = [
  {
    q: 'Can vehicles reach the Ghats on Shahi Snan days?',
    a: 'Direct vehicular access within 1.5 km of Ramkund and Kushavarta is closed to public traffic by Nashik Police during main bathing days. Our verified parking plots are located just outside the pedestrian perimeter with approved approach routes.',
  },
  {
    q: 'How does the digital QR pass work without mobile reception?',
    a: 'Your booking pass is saved offline in the app as soon as confirmed. You can display the QR code and entry code to the host even with zero cellular signal.',
  },
  {
    q: 'What types of vehicles can I park?',
    a: 'We support 2-wheelers (scooters/motorbikes), 4-wheelers (hatchbacks, sedans, SUVs), and designated tourist buses/tempo travellers with dedicated wide-gate compounds.',
  },
  {
    q: 'What if I need to cancel or modify my arrival time?',
    a: 'You can cancel up to 2 hours before your scheduled arrival time for a full instant refund or easily update your vehicle number from "My Bookings".',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { patchFilters } = useApp()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedZone, setSelectedZone] = useState('all')
  const [selectedVehicle, setSelectedVehicle] = useState('all')
  const [selectedTab, setSelectedTab] = useState('all')
  const [openFaq, setOpenFaq] = useState(0)

  const { data: zones } = useAsync(() => getZones(), [])
  const { data: spots, loading } = useAsync(() => searchSpots({ zone: 'all', openNow: false }), [])

  const revealRef = useReveal([zones, spots])

  const openCount = useMemo(() => {
    return spots?.filter((s) => s.availability !== 'full').length ?? 0
  }, [spots])

  const byZone = useMemo(() => {
    const map = new Map()
    for (const spot of spots ?? []) {
      const entry = map.get(spot.zoneId) ?? { total: 0, open: 0, cheapest: Infinity }
      entry.total += 1
      if (spot.availability !== 'full') entry.open += 1
      entry.cheapest = Math.min(entry.cheapest, spot.priceHour)
      map.set(spot.zoneId, entry)
    }
    return map
  }, [spots])

  // Filtered preview spots for featured section
  const filteredSpots = useMemo(() => {
    if (!spots) return []
    let list = [...spots]
    if (selectedTab === 'ramkund') {
      list = list.filter((s) => s.zoneId === 'ramkund' || s.zoneId === 'panchavati')
    } else if (selectedTab === 'instant') {
      list = list.filter((s) => s.instantBook)
    } else if (selectedTab === 'value') {
      list = [...list].sort((a, b) => a.priceHour - b.priceHour)
    } else if (selectedTab === 'gated') {
      list = list.filter((s) => s.features?.includes('gated') || s.features?.includes('covered'))
    }
    return list.slice(0, 6)
  }, [spots, selectedTab])

  const handleSearchSubmit = (e) => {
    e?.preventDefault()
    patchFilters({
      q: searchQuery.trim(),
      zone: selectedZone,
      vehicle: selectedVehicle,
    })
    const params = new URLSearchParams()
    if (selectedZone !== 'all') params.set('zone', selectedZone)
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedVehicle !== 'all') params.set('vehicle', selectedVehicle)
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const handleQuickSearch = (zone, q) => {
    patchFilters({ zone, q, vehicle: 'all' })
    navigate(`/search?zone=${zone}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
  }

  return (
    <PageShell>
      {/* ------------------------------ HERO SECTION ----------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2b1b16] via-[#1f1614] to-bg pt-8 pb-16 text-white md:pt-14 md:pb-24">
        {/* Ambient atmospheric glow elements */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl bg-[radial-gradient(ellipse_at_center,rgba(214,69,69,0.35),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(214,138,0,0.2),transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute top-40 -right-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(214,69,69,0.2),transparent_70%)] blur-2xl" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          {/* Top Trust Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>Kumbh Mela 2027 Smart Parking Assistant</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/90">
              <Icon name="checkCircle" size={13} className="text-emerald-400" />
              <span>Nashik Traffic Police Compatible</span>
            </span>
          </div>

          {/* Hero Headlines */}
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance">
              Guaranteed Parking Near <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#ff9b71] via-[#ffd166] to-[#f47068] bg-clip-text text-transparent">
                Nashik & Trimbak Ghats
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-[17px]">
              Avoid mela traffic bottlenecks. Pre-book secure private compounds, ashrams, and verified plots within 3–7
              minutes walking distance from holy Snan points.
            </p>
          </div>

          {/* ------------------- INTERACTIVE SEARCH WIDGET ------------------- */}
          <div className="mt-8 rounded-2xl border border-white/20 bg-surface/95 p-3 text-text shadow-2xl backdrop-blur-md sm:p-4">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-12 sm:gap-3">
                {/* Search query input */}
                <div className="relative sm:col-span-5">
                  <label htmlFor="search-input" className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                    Destination / Ghat
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-accent">
                    <Icon name="search" size={18} className="shrink-0 text-accent" />
                    <input
                      id="search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Ramkund, Panchavati, Tapovan..."
                      className="w-full bg-transparent text-[14px] font-medium text-text placeholder:text-muted/70 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-muted hover:text-text"
                        aria-label="Clear destination"
                      >
                        <Icon name="x" size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Zone selector */}
                <div className="sm:col-span-4">
                  <label htmlFor="zone-select" className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                    Kumbh Zone
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-accent">
                    <Icon name="pin" size={18} className="shrink-0 text-muted" />
                    <select
                      id="zone-select"
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      className="w-full bg-transparent text-[14px] font-medium text-text focus:outline-none"
                    >
                      <option value="all">All Zones ({spots?.length ?? 0} spots)</option>
                      {(zones ?? []).map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} ({z.short})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vehicle type selector */}
                <div className="sm:col-span-3">
                  <label htmlFor="vehicle-select" className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                    Vehicle Type
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-accent">
                    <Icon
                      name={selectedVehicle === '2w' ? 'bike' : selectedVehicle === 'bus' ? 'bus' : 'car'}
                      size={18}
                      className="shrink-0 text-muted"
                    />
                    <select
                      id="vehicle-select"
                      value={selectedVehicle}
                      onChange={(e) => setSelectedVehicle(e.target.value)}
                      className="w-full bg-transparent text-[14px] font-medium text-text focus:outline-none"
                    >
                      <option value="all">Any vehicle</option>
                      <option value="car">Car / SUV</option>
                      <option value="2w">Two Wheeler</option>
                      <option value="bus">Tourist Bus</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Quick pills & Action CTA */}
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                  <span className="shrink-0 text-[11px] font-semibold text-muted">Quick:</span>
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleQuickSearch(item.zone, item.q)}
                      className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent active:scale-95"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <Button
                  type="submit"
                  size="md"
                  className="w-full shrink-0 sm:w-auto px-6 shadow-md"
                  icon={<Icon name="search" size={16} strokeWidth={2.4} />}
                >
                  Find Available Parking
                </Button>
              </div>
            </form>
          </div>

          {/* Live Capacity Highlights */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[13px] text-white/90">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <strong>{loading ? 'Checking...' : `${openCount} Spots Open`}</strong> right now
            </span>
            <span className="text-white/40">•</span>
            <span>Avg. rate: ₹30/hr</span>
            <span className="text-white/40">•</span>
            <Link to="/search?sort=distance" className="font-medium text-[#ffd166] underline-offset-4 hover:underline">
              View nearest to Ramkund →
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------- TRUST STRIP -------------------------- */}
      <section className="border-y border-line bg-surface py-5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {TRUST_METRICS.map((item) => (
              <div key={item.title} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon name={item.icon} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-text truncate">{item.title}</p>
                  <p className="text-[11px] text-muted truncate">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------- FEATURED PARKING SECTION ---------------------- */}
      <div ref={revealRef} className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-bold tracking-wider text-accent uppercase">Live Availability</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-text sm:text-3xl">
              Featured Parking Near Ghats
            </h2>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent transition-transform hover:translate-x-0.5"
          >
            <span>Explore all {spots?.length ?? 0} listings</span>
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        {/* Filter Categories Pill Bar */}
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedTab('all')}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
              selectedTab === 'all'
                ? 'bg-text text-white shadow-sm'
                : 'bg-surface text-muted hover:bg-surface-sunken hover:text-text card-shadow'
            }`}
          >
            All Recommended
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('ramkund')}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
              selectedTab === 'ramkund'
                ? 'bg-text text-white shadow-sm'
                : 'bg-surface text-muted hover:bg-surface-sunken hover:text-text card-shadow'
            }`}
          >
            🔥 Closest to Ramkund
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('instant')}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
              selectedTab === 'instant'
                ? 'bg-text text-white shadow-sm'
                : 'bg-surface text-muted hover:bg-surface-sunken hover:text-text card-shadow'
            }`}
          >
            ⚡ Instant QR Entry
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('gated')}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
              selectedTab === 'gated'
                ? 'bg-text text-white shadow-sm'
                : 'bg-surface text-muted hover:bg-surface-sunken hover:text-text card-shadow'
            }`}
          >
            🛡️ Gated & Covered
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('value')}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
              selectedTab === 'value'
                ? 'bg-text text-white shadow-sm'
                : 'bg-surface text-muted hover:bg-surface-sunken hover:text-text card-shadow'
            }`}
          >
            🪙 Best Hourly Value
          </button>
        </div>

        {/* Spots Grid */}
        {loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <div key={k} className="space-y-3 rounded-2xl bg-surface p-3 card-shadow">
                <Skeleton className="aspect-[16/9] w-full" rounded="rounded-xl" />
                <Skeleton className="h-4 w-3/4" rounded="rounded-full" />
                <Skeleton className="h-3 w-1/2" rounded="rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSpots.map((spot, index) => {
              const availability = AVAILABILITY[spot.availability] ?? AVAILABILITY.available
              return (
                <div
                  key={spot.id}
                  className="reveal group flex flex-col justify-between overflow-hidden rounded-2xl bg-surface card-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                  style={{ '--i': index }}
                >
                  <div>
                    {/* Spot Photo Banner */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-sunken">
                      <Photo seed={spot.id} label={spot.zone?.short ?? 'NASHIK'} ratio="aspect-[16/9]" rounded="rounded-none" />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <StatusPill
                          tone={availability.tone}
                          label={availability.label}
                          pulse={spot.availability === 'filling'}
                          size="sm"
                        />
                      </div>
                      <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                        {metres(spot.distanceM)} from Ghat
                      </div>
                    </div>

                    {/* Spot Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[15px] font-bold text-text line-clamp-1 group-hover:text-accent transition-colors">
                          {spot.title}
                        </h3>
                      </div>

                      <p className="mt-1 text-[12px] text-muted line-clamp-1">
                        {spot.address || `${spot.zone?.name} Area`}
                      </p>

                      {/* Ratings & Host Badges */}
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Rating value={spot.rating} reviews={spot.reviews} size={13} />
                          {spot.verified && <VerifiedBadge size={11} />}
                        </div>
                        {spot.instantBook && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
                            <Icon name="bolt" size={12} />
                            Instant
                          </span>
                        )}
                      </div>

                      {/* Amenities Pills */}
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/60 pt-2.5">
                        {(spot.features ?? []).slice(0, 3).map((feat) => (
                          <span
                            key={feat}
                            className="rounded-md bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-muted capitalize"
                          >
                            {feat}
                          </span>
                        ))}
                        <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-muted">
                          {spot.spotsLeft} spots free
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & CTA footer */}
                  <div className="flex items-center justify-between border-t border-line bg-surface-sunken/40 px-4 py-3">
                    <div>
                      <p className="text-[16px] font-extrabold text-text">
                        {money(spot.priceHour)}
                        <span className="text-[11px] font-normal text-muted">/hr</span>
                      </p>
                      <p className="text-[10px] text-muted">or {money(spot.priceDay)}/day</p>
                    </div>

                    <Link to={`/listing/${spot.id}`}>
                      <Button size="sm" variant="primary">
                        Reserve Spot
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* -------------------- ZONE COVERAGE SHOWCASE -------------------- */}
        <section className="mt-20">
          <div className="text-center">
            <p className="text-[12px] font-bold tracking-wider text-accent uppercase">Mela Sectors</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-text sm:text-3xl">
              Parking Across All Kumbh Zones
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[14px] text-muted">
              Choose your sector based on your arrival route to bypass barricaded riverfront zones.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(zones ?? []).map((zone, index) => {
              const stats = byZone.get(zone.id) ?? { total: 0, open: 0, cheapest: 0 }
              return (
                <Link
                  key={zone.id}
                  to={`/search?zone=${zone.id}`}
                  className="reveal group flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 card-shadow transition-all duration-200 hover:border-accent/40 hover:shadow-lg"
                  style={{ '--i': index }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid size-10 place-items-center rounded-xl bg-surface-sunken text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                        <Icon name="pin" size={20} />
                      </span>
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                        {zone.tag}
                      </span>
                    </div>

                    <h3 className="mt-4 text-[16px] font-bold text-text group-hover:text-accent transition-colors">
                      {zone.name}
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{zone.blurb}</p>

                    <div className="mt-3 rounded-lg bg-surface-sunken p-2.5 text-[11px] text-muted">
                      <span className="font-semibold text-text">Traffic note:</span> {zone.melaNote}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-[12px]">
                    <div>
                      <span className="font-bold text-emerald-600">{stats.open} spots open</span>
                      <span className="text-muted"> of {stats.total}</span>
                    </div>
                    <span className="font-semibold text-accent group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      {stats.cheapest && stats.cheapest < Infinity ? `from ${money(stats.cheapest)}/hr` : 'View spots'} →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ------------------- HOW IT WORKS SECTION ------------------- */}
        <section className="mt-20 rounded-3xl bg-surface-sunken/70 p-6 sm:p-10 border border-line/70">
          <div className="text-center">
            <p className="text-[12px] font-bold tracking-wider text-accent uppercase">Simple 3-Step Flow</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-text sm:text-3xl">
              How Kumbh Parking Connect Works
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[14px] text-muted">
              Designed specifically for high-density festival days with offline pass support.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item, index) => (
              <div
                key={item.title}
                className="reveal relative rounded-2xl bg-surface p-6 card-shadow border border-line/50 flex flex-col items-start"
                style={{ '--i': index }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="text-[26px] font-black text-line">{item.step}</span>
                </div>
                <h3 className="mt-4 text-[16px] font-bold text-text">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ----------------- HOST / RESIDENT MONETIZATION BANNER ----------------- */}
        <section className="reveal my-16 overflow-hidden rounded-3xl bg-gradient-to-r from-[#1a1a1a] via-[#2c1d1a] to-[#3a1a16] p-6 sm:p-10 text-white shadow-xl relative">
          <div className="pointer-events-none absolute -right-16 -bottom-16 size-80 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/90">
              <Icon name="home" size={13} />
              For Nashik & Trimbak Residents
            </span>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-4xl text-balance leading-tight">
              Turn your driveway or plot into <span className="text-[#ffd166]">₹4,000–₹10,000 / day</span> during Kumbh Mela.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/80 sm:text-[15px]">
              List your empty space in under 3 minutes. Accept bookings on your terms, get instant UPI settlements, and
              help pilgrims find verified, safe parking.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" variant="primary" onClick={() => navigate('/host/new')}>
                List Your Space for Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:border-white/40"
                onClick={() => navigate('/host')}
              >
                Host Dashboard
              </Button>
            </div>
          </div>
        </section>

        {/* --------------------- PILGRIM FAQS ACCORDION --------------------- */}
        <section className="mt-12">
          <div className="text-center">
            <p className="text-[12px] font-bold tracking-wider text-accent uppercase">Got Questions?</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-text sm:text-3xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mx-auto mt-8 max-w-3xl space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-2xl border border-line bg-surface card-shadow transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left font-semibold text-text hover:bg-surface-sunken/40 sm:p-5"
                  >
                    <span className="text-[15px] font-bold">{faq.q}</span>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : 'text-muted'}`}>
                      <Icon name="chevronDown" size={16} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line/60 bg-surface-sunken/30 px-4 pt-3 pb-5 text-[13px] leading-relaxed text-muted sm:px-5">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ------------------------------ FOOTER ----------------------------- */}
      <footer className="mt-16 border-t border-line bg-surface px-4 pt-12 pb-24 text-center sm:pb-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-accent text-[15px] font-bold text-white shadow-sm">
                P
              </span>
              <span className="text-[16px] font-bold text-text">Nashik Parking Connect</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-[13px] font-medium text-muted">
              <Link to="/search" className="hover:text-accent">Find Parking</Link>
              <Link to="/bookings" className="hover:text-accent">My Bookings</Link>
              <Link to="/host" className="hover:text-accent">Host Portal</Link>
              <Link to="/admin" className="hover:text-accent">Admin Console</Link>
            </div>
          </div>

          <div className="mt-8 border-t border-line/60 pt-6 text-[12px] text-muted">
            <p>Dedicated Smart Mobility & Crowd Management Initiative for Nashik-Trimbakeshwar Kumbh Mela.</p>
            <p className="mt-1 text-[11px] text-muted/80">
              © {new Date().getFullYear()} Nashik Parking Connect. All verified private parking listings are subject to local traffic guidelines.
            </p>
          </div>
        </div>
      </footer>
    </PageShell>
  )
}
