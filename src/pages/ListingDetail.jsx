import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSpot, getSpotReviews, setSaved } from '@/api'
import { hostById } from '@/api/mock/hosts'
import { VEHICLE_TYPES } from '@/api/mock/spots'
import { cn } from '@/lib/cn'
import { metres, money } from '@/lib/format'
import { AVAILABILITY } from '@/lib/status'
import { useAsync } from '@/hooks/useAsync'
import { PageShell } from '@/components/layout/PageShell'
import KumbhMap from '@/components/map/KumbhMap'
import BookingSheet from '@/components/booking/BookingSheet'
import Photo from '@/components/ui/Photo'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import StatusPill from '@/components/ui/StatusPill'
import { Avatar, Rating, VerifiedBadge } from '@/components/ui/Bits'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useApp } from '@/context/AppContext'

const FEATURE_ICON = {
  covered: 'home',
  gate: 'lock',
  cctv: 'video',
  floodlight: 'bulb',
  caretaker: 'user',
  water: 'droplet',
  ev: 'bolt',
  wide: 'wide',
}

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

export default function ListingDetail() {
  const { id } = useParams()
  return <ListingView key={id} id={id} />
}

function ListingView({ id }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { isSaved, toggleSaved } = useApp()

  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [bookingOpen, setBookingOpen] = useState(false)

  const { data: spot, loading, error, reload } = useAsync(() => getSpot(id), [id])
  const { data: reviews } = useAsync(() => getSpotReviews(id), [id])

  const host = useMemo(() => hostById(spot?.hostId), [spot?.hostId])
  const availability = AVAILABILITY[spot?.availability] ?? AVAILABILITY.available

  if (error || (!loading && !spot)) {
    return (
      <PageShell>
        <ErrorState message="This parking listing is no longer available." onRetry={reload} className="pt-16" />
      </PageShell>
    )
  }

  if (!spot) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
          <Skeleton className="h-64 w-full" rounded="rounded-3xl" />
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-1/2" rounded="rounded-full" />
            <SkeletonText lines={4} />
          </div>
        </div>
      </PageShell>
    )
  }

  const isFilling = spot.availability === 'filling'
  const isFull = spot.availability === 'full'

  return (
    <PageShell>
      {/* -------------------- TOP ACTION BAR -------------------- */}
      <div className="sticky top-0 z-[600] border-b border-[#E8E1D6] bg-[#FAF7F2]/95 backdrop-blur-md px-4 py-2.5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex items-center gap-1.5 rounded-xl border border-[#E8E1D6] bg-white px-3 py-1.5 text-[13px] font-bold text-[#16191E] shadow-2xs hover:bg-[#F2EDE4] active:scale-95 transition-all"
          >
            <Icon name="chevronLeft" size={18} />
            <span>Back to listings</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const next = !isSaved(spot.id)
                toggleSaved(spot.id)
                await setSaved(spot.id, next)
                toast.push({ tone: 'success', title: next ? 'Saved' : 'Removed from saved', message: spot.title })
              }}
              aria-label="Save"
              className="grid size-9 place-items-center rounded-xl border border-[#E8E1D6] bg-white text-[#16191E] shadow-2xs hover:bg-[#F2EDE4] active:scale-95 transition-all"
            >
              <Icon
                name="heart"
                size={18}
                filled={isSaved(spot.id)}
                className={isSaved(spot.id) ? 'text-[#D9483B]' : ''}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href)
                toast.push({ tone: 'info', title: 'Listing link copied' })
              }}
              aria-label="Share"
              className="grid size-9 place-items-center rounded-xl border border-[#E8E1D6] bg-white text-[#16191E] shadow-2xs hover:bg-[#F2EDE4] active:scale-95 transition-all"
            >
              <Icon name="share" size={17} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-8 pb-32">
        {/* =========================================================================
            PRIMARY HERO: LARGE PHYSICAL KUMBH PARK PARKING SIGN
        ========================================================================= */}
        <div className="relative pt-2">
          {/* Subtle Suspension Mount Eyelets */}
          <div className="relative mx-auto flex w-[84%] justify-between px-6 sm:px-12 mb-[-8px]">
            <div className="flex flex-col items-center">
              <span className="size-3 rounded-full bg-[#8A95A5] border-2 border-[#1E293B]" />
              <div className="w-[2.5px] h-4 bg-gradient-to-b from-[#8A95A5] to-[#475569]" />
            </div>
            <div className="flex flex-col items-center">
              <span className="size-3 rounded-full bg-[#8A95A5] border-2 border-[#1E293B]" />
              <div className="w-[2.5px] h-4 bg-gradient-to-b from-[#8A95A5] to-[#475569]" />
            </div>
          </div>

          {/* Large Highway Green Signboard */}
          <div className="relative overflow-hidden rounded-3xl bg-[#006B4F] p-5 text-white shadow-2xl ring-4 ring-[#006B4F]/40 border-3 border-white sm:p-7">
            {/* Reflective Surface Sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/15" />

            {/* Heavy-Duty Corner Rivets */}
            <span className="absolute top-3 left-3 size-2.5 rounded-full bg-white/90 border border-[#003822] shadow-xs" />
            <span className="absolute top-3 right-3 size-2.5 rounded-full bg-white/90 border border-[#003822] shadow-xs" />
            <span className="absolute bottom-3 left-3 size-2.5 rounded-full bg-white/90 border border-[#003822] shadow-xs" />
            <span className="absolute bottom-3 right-3 size-2.5 rounded-full bg-white/90 border border-[#003822] shadow-xs" />

            {/* Sign Layout Content */}
            <div className="relative z-10 space-y-3.5">
              {/* Top Wayfinding Line */}
              <div className="flex items-center justify-between border-b border-white/30 pb-2 text-[11px] font-mono font-bold tracking-widest text-[#E9A83A] uppercase sm:text-[13px]">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#FFD166] animate-pulse" />
                  KUMBH PARK • SECTOR {spot.zone?.short ?? 'NASHIK'}
                </span>
                <span>{spot.zone?.name?.toUpperCase()} ZONE</span>
              </div>

              {/* Main Spot Title & Address */}
              <div className="py-1">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight uppercase font-heading text-white drop-shadow-sm leading-tight">
                  {spot.title}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] sm:text-[14px] font-bold text-[#FAF7F2]/90">
                  <Icon name="pin" size={14} className="text-[#FFD166] shrink-0" />
                  <span>{spot.address}</span>
                </p>
              </div>

              {/* Highway Metrics Strip on Sign */}
              <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-3 border-t border-white/30">
                {/* Metric 1: Distance & Ghat */}
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-3.5 py-2.5 border border-white/40">
                  <span className="text-2xl font-black text-[#FFD166]">➔</span>
                  <div className="font-mono leading-tight">
                    <span className="text-[16px] sm:text-[18px] font-black tracking-tight text-white block">
                      {metres(spot.distanceM)}
                    </span>
                    <span className="text-[10px] font-bold text-[#FAF7F2]/80 uppercase block">
                      TO {spot.ghat?.name?.toUpperCase() || 'RAMKUND'}
                    </span>
                  </div>
                </div>

                {/* Metric 2: Live Tariff Rate */}
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-3.5 py-2.5 border border-white/40">
                  <span className="text-xl font-black text-[#FFD166]">₹</span>
                  <div className="font-mono leading-tight">
                    <span className="text-[16px] sm:text-[18px] font-black tracking-tight text-white block">
                      {money(spot.priceHour)}
                      <span className="text-[11px] font-normal text-white/80">/HR</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#FAF7F2]/80 uppercase block">
                      OR {money(spot.priceDay)} / FULL DAY
                    </span>
                  </div>
                </div>

                {/* Metric 3: Live Availability Status */}
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-3.5 py-2.5 border border-white/40">
                  <span className={cn('size-3 rounded-full', isFull ? 'bg-red-400' : isFilling ? 'bg-[#FFD166]' : 'bg-emerald-400 animate-pulse')} />
                  <div className="font-mono leading-tight">
                    <span className="text-[14px] sm:text-[16px] font-black tracking-tight text-white block">
                      {spot.spotsLeft > 0 ? `${spot.spotsLeft} SPOTS FREE` : 'LOT FULL'}
                    </span>
                    <span className="text-[10px] font-bold text-[#FAF7F2]/80 uppercase block">
                      OF {spot.capacity} TOTAL BAYS
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Authority Tag */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] font-bold text-white/80 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Icon name="shield" size={13} className="text-[#FFD166]" />
                  100% VERIFIED PRIVATE COMPOUND
                </span>
                <span>GATE HOURS: {spot.checkInFrom} – {spot.checkOutBy}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            STRUCTURED PARKING DETAILS & TRUST METRICS
        ========================================================================= */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column (Details, Amenities, Host, Map) */}
          <div className="space-y-6 lg:col-span-7">
            {/* Quick Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E1D6] bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <Rating value={spot.rating} reviews={spot.reviews} size={15} />
                <span className="text-[#E8E1D6]">|</span>
                {spot.verified && <VerifiedBadge label="Verified Listing" />}
              </div>
              <StatusPill tone={availability.tone} label={availability.label} pulse={isFilling} />
            </div>

            {/* What this spot offers */}
            <div className="rounded-2xl border border-[#E8E1D6] bg-white p-5 shadow-2xs space-y-4">
              <h2 className="text-[16px] font-bold text-[#16191E] font-heading">
                Spot Amenities & Security Features
              </h2>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {spot.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2.5 rounded-xl border border-[#E8E1D6] bg-[#FAF7F2] p-2.5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#005A36] text-white shadow-2xs">
                      <Icon name={FEATURE_ICON[feature] ?? 'check'} size={14} />
                    </span>
                    <span className="text-[12px] font-bold text-[#16191E]">{featureLabelLocal(feature)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E8E1D6]">
                {spot.vehicles.map((vehicle) => {
                  const type = VEHICLE_TYPES.find((v) => v.id === vehicle)
                  return (
                    <span
                      key={vehicle}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D6] bg-white px-3 py-1.5 text-[12px] font-bold text-[#16191E]"
                    >
                      <Icon name={VEHICLE_ICON[vehicle]} size={14} className="text-[#005A36]" />
                      {type?.label}
                    </span>
                  )
                })}
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D6] bg-white px-3 py-1.5 text-[12px] font-bold text-[#16191E]">
                  <Icon name="ruler" size={14} className="text-[#005A36]" />
                  {spot.clearanceM}m clearance
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D6] bg-white px-3 py-1.5 text-[12px] font-bold text-[#16191E]">
                  <Icon name="layers" size={14} className="text-[#005A36]" />
                  {spot.surface}
                </span>
              </div>
            </div>

            {/* About this spot & gate rules */}
            <div className="rounded-2xl border border-[#E8E1D6] bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-[16px] font-bold text-[#16191E] font-heading">
                About this Parking Compound
              </h2>
              <p className="text-[13px] leading-relaxed text-[#4A4A4A]">{spot.description}</p>
              {spot.rules?.length > 0 && (
                <div className="pt-2">
                  <p className="text-[12px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">
                    Compound Rules & Guidelines
                  </p>
                  <ul className="space-y-1.5">
                    {spot.rules.map((rule) => (
                      <li key={rule} className="flex items-start gap-2 text-[12px] text-[#16191E]">
                        <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[#1B8347]" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Location & Map Preview */}
            <div className="rounded-2xl border border-[#E8E1D6] bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-[16px] font-bold text-[#16191E] font-heading">
                Location & Approach Route
              </h2>
              <div className="overflow-hidden rounded-xl border border-[#E8E1D6]">
                <div className="relative h-44">
                  <KumbhMap
                    spots={[{ ...spot, from: spot.priceHour }]}
                    center={spot.latlng}
                    zoom={16}
                    selectedId={spot.id}
                    showZoom={false}
                    interactive={false}
                  />
                </div>
              </div>
              <div className="space-y-1 text-[12px] text-[#4A4A4A]">
                <p className="flex items-center gap-2 font-bold text-[#16191E]">
                  <Icon name="pin" size={14} className="text-[#D9483B] shrink-0" />
                  {spot.address}
                </p>
                <p className="flex items-center gap-2">
                  <Icon name="clock" size={14} className="text-[#005A36] shrink-0" />
                  {spot.walkM} min walk to {spot.ghat?.name}
                </p>
                <p className="flex items-center gap-2 text-[#6B6B6B]">
                  <Icon name="layers" size={14} className="text-[#6B6B6B] shrink-0" />
                  {spot.zone?.name} • Traffic note: {spot.zone?.melaNote}
                </p>
              </div>
            </div>

            {/* Host Section */}
            {host && (
              <div className="rounded-2xl border border-[#E8E1D6] bg-white p-5 shadow-2xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar initials={host.initials} size={46} />
                  <div>
                    <p className="text-[14px] font-bold text-[#16191E] flex items-center gap-1.5">
                      <span>{host.name}</span>
                      {host.verified && <Icon name="shield" size={14} className="text-[#1B8347]" />}
                    </p>
                    <p className="text-[11px] text-[#6B6B6B]">
                      Verified Host since {host.since} • Responds {host.responseTime}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" icon={<Icon name="phone" size={14} />}>
                  Contact
                </Button>
              </div>
            )}
          </div>

          {/* Right Column (Secondary Photo Gallery & Booking Summary) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Secondary Photo Gallery Container */}
            <div className="rounded-2xl border border-[#E8E1D6] bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                  Compound & Gate Photos
                </h3>
                <span className="text-[11px] font-bold text-[#005A36]">
                  {activePhotoIndex + 1} of {spot.photoCount || 3}
                </span>
              </div>

              {/* Main Secondary Photo Display with Tone Grading */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#F2EDE4] border border-[#E8E1D6]">
                <Photo
                  seed={`${spot.id}-${activePhotoIndex}`}
                  label={`${spot.title} photo`}
                  ratio="aspect-[16/10]"
                  rounded="rounded-xl"
                />
              </div>

              {/* Photo Thumbnails Strip */}
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: spot.photoCount || 4 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-lg border-2 transition-all cursor-pointer',
                      activePhotoIndex === idx
                        ? 'border-[#005A36] ring-2 ring-[#005A36]/30 scale-95'
                        : 'border-[#E8E1D6] opacity-75 hover:opacity-100',
                    )}
                  >
                    <Photo
                      seed={`${spot.id}-${idx}`}
                      label={`thumb-${idx}`}
                      ratio="aspect-square"
                      rounded="rounded-none"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Reviews Section */}
            {reviews?.length > 0 && (
              <div className="rounded-2xl border border-[#E8E1D6] bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#E8E1D6] pb-2.5">
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                    Pilgrim Reviews
                  </h3>
                  <span className="text-[12px] font-bold text-[#16191E] flex items-center gap-1">
                    <Icon name="star" size={13} filled className="text-[#FFD166]" />
                    {spot.rating} ({spot.reviews})
                  </span>
                </div>
                <div className="space-y-2.5">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="rounded-xl bg-[#FAF7F2] p-3 text-[12px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-[#16191E]">
                        <span>{review.author}</span>
                        <span className="text-[10px] font-normal text-[#6B6B6B]">{review.when}</span>
                      </div>
                      <p className="text-[#4A4A4A] leading-snug">{review.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          DOMINANT LARGE STICKY BOOK NOW CTA BAR
      ========================================================================= */}
      <div className="fixed inset-x-0 bottom-0 z-[750] border-t-2 border-[#1A2433] bg-[#FAF7F2] px-4 py-3.5 shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] block">
              Tariff from
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-black text-[#16191E] leading-none">
                {money(spot.priceHour)}
              </span>
              <span className="text-[12px] font-bold text-[#6B6B6B]">/hr</span>
              <span className="text-[11px] text-[#6B6B6B] hidden sm:inline">• {money(spot.priceDay)}/day</span>
            </div>
          </div>

          <Button
            size="lg"
            variant="primary"
            disabled={isFull}
            onClick={() => setBookingOpen(true)}
            className="w-full sm:w-auto px-8 py-3.5 font-black text-[16px] uppercase tracking-wide bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] shadow-lg active:scale-[0.98] transition-all cursor-pointer"
            icon={<Icon name="bolt" size={18} strokeWidth={2.6} />}
          >
            {isFull ? 'Spot Full — Join Waitlist' : 'Book This Parking'}
          </Button>
        </div>
      </div>

      {/* Booking Sheet Modal */}
      <BookingSheet open={bookingOpen} onClose={() => setBookingOpen(false)} spot={spot} />
    </PageShell>
  )
}

function featureLabelLocal(id) {
  const map = {
    covered: 'Covered Bay',
    gate: 'Gated Compound',
    cctv: 'CCTV Surveillance',
    floodlight: 'Floodlights',
    caretaker: 'On-Site Caretaker',
    water: 'Drinking Water',
    ev: 'EV Charging',
    wide: 'Wide Bus Entry',
  }
  return map[id] ?? id
}
