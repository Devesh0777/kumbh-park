import { useMemo, useRef, useState } from 'react'
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
  // Keying on the id resets carousel/star state when navigating between
  // listings without an explicit reset effect.
  return <ListingView key={id} id={id} />
}

function ListingView({ id }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { isSaved, toggleSaved } = useApp()

  const [slide, setSlide] = useState(0)
  const [bookingOpen, setBookingOpen] = useState(false)
  const railRef = useRef(null)

  const { data: spot, loading, error, reload } = useAsync(() => getSpot(id), [id])
  const { data: reviews } = useAsync(() => getSpotReviews(id), [id])

  const host = useMemo(() => hostById(spot?.hostId), [spot?.hostId])
  const availability = AVAILABILITY[spot?.availability] ?? AVAILABILITY.available

  if (error || (!loading && !spot)) {
    return (
      <PageShell>
        <ErrorState message="This listing is no longer available." onRetry={reload} className="pt-16" />
      </PageShell>
    )
  }

  // Everything below dereferences `spot`, so hold the skeleton until it exists.
  if (!spot) {
    return (
      <PageShell>
        <div className="pb-24">
          <Skeleton className="aspect-[4/3] w-full sm:aspect-[16/9]" rounded="rounded-none" />
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" rounded="rounded-full" />
            <SkeletonText lines={3} />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {/* --------------------------------- carousel ------------------------------ */}
      <div className="relative">
        <div
          ref={railRef}
          onScroll={(event) => {
            const width = event.currentTarget.clientWidth
            setSlide(Math.round(event.currentTarget.scrollLeft / width))
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {Array.from({ length: spot.photoCount || 4 }).map((_, index) => (
            <Photo
              key={index}
              seed={`${spot.id}-${index}`}
              label={`${spot.zone?.short} · ${index + 1}`}
              ratio="aspect-[4/3] w-full shrink-0 snap-center sm:aspect-[16/9]"
              rounded="rounded-none"
            />
          ))}
        </div>

        {/* gradient + floating controls */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 pt-safe px-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="grid size-10 place-items-center rounded-full bg-surface/95 text-text card-shadow transition-transform active:scale-95"
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const next = !isSaved(spot.id)
                toggleSaved(spot.id)
                await setSaved(spot.id, next)
                toast.push({ tone: 'success', title: next ? 'Saved' : 'Removed from saved', message: spot.title })
              }}
              aria-label="Save"
              className="grid size-10 place-items-center rounded-full bg-surface/95 text-text card-shadow transition-transform active:scale-95"
            >
              <Icon
                name="heart"
                size={20}
                filled={isSaved(spot.id)}
                className={isSaved(spot.id) ? 'text-accent' : ''}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href)
                toast.push({ tone: 'info', title: 'Link copied' })
              }}
              aria-label="Share"
              className="grid size-10 place-items-center rounded-full bg-surface/95 text-text card-shadow transition-transform active:scale-95"
            >
              <Icon name="share" size={19} />
            </button>
          </div>
        </div>

        {!loading && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2 py-1.5 backdrop-blur-sm">
            {Array.from({ length: spot.photoCount || 4 }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200 [transition-timing-function:var(--ease-out-expo)]',
                  index === slide ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------- content ------------------------------- */}
      <div className="mx-auto max-w-3xl">
        <section className="border-b border-line p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[20px] leading-snug font-bold">{spot.title}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                <Icon name="pin" size={14} />
                {spot.address}
              </p>
            </div>
            <StatusPill
              tone={availability.tone}
              label={availability.label}
              pulse={spot.availability === 'filling'}
              className="mt-1 shrink-0"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Rating value={spot.rating} reviews={spot.reviews} />
            <span className="text-[13px] text-muted">
              {metres(spot.distanceM)} from {spot.ghat?.name}
            </span>
            {spot.verified && <VerifiedBadge label="Listing verified" />}
          </div>

          <div className="mt-4 flex items-end justify-between rounded-[14px] bg-surface-sunken p-3.5">
            <div>
              <p className="text-[20px] leading-none font-bold">
                {money(spot.priceHour)}
                <span className="text-[13px] font-medium text-muted">/hour</span>
              </p>
              <p className="mt-1 text-[12px] text-muted">{money(spot.priceDay)} for a full day</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold">
                {spot.spotsLeft > 0 ? `${spot.spotsLeft} of ${spot.capacity} free` : 'Currently full'}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                Gate {spot.checkInFrom}–{spot.checkOutBy}
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-line p-4">
          <h2 className="text-[15px] font-semibold">What this spot offers</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {spot.features.map((feature) => (
              <div key={feature} className="flex items-center gap-2 rounded-[12px] bg-surface p-2.5 card-shadow">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon name={FEATURE_ICON[feature] ?? 'check'} size={14} />
                </span>
                <span className="text-[12px] leading-tight font-semibold">{featureLabelLocal(feature)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {spot.vehicles.map((vehicle) => {
              const type = VEHICLE_TYPES.find((v) => v.id === vehicle)
              return (
                <span
                  key={vehicle}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold"
                >
                  <Icon name={VEHICLE_ICON[vehicle]} size={14} />
                  {type?.label}
                </span>
              )
            })}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold">
              <Icon name="ruler" size={14} />
              {spot.clearanceM}m clearance
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold">
              <Icon name="layers" size={14} />
              {spot.surface}
            </span>
          </div>
        </section>

        <section className="border-b border-line p-4">
          <h2 className="text-[15px] font-semibold">About this spot</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{spot.description}</p>
          <ul className="mt-3 space-y-2">
            {spot.rules?.map((rule) => (
              <li key={rule} className="flex items-start gap-2 text-[13px]">
                <Icon name="check" size={15} className="mt-0.5 shrink-0 text-success" />
                <span className="text-muted">{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-line p-4">
          <h2 className="text-[15px] font-semibold">Where it is</h2>
          <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-line">
            <div className="relative h-48">
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
          <div className="mt-3 space-y-1.5 text-[13px]">
            <p className="flex items-center gap-2">
              <Icon name="pin" size={15} className="shrink-0 text-muted" />
              {spot.address}
            </p>
            <p className="flex items-center gap-2 text-muted">
              <Icon name="clock" size={15} className="shrink-0" />
              {spot.walkM} min walk from {spot.ghat?.name}
            </p>
            <p className="flex items-center gap-2 text-muted">
              <Icon name="layers" size={15} className="shrink-0" />
              {spot.zone?.name} · {spot.zone?.melaNote}
            </p>
          </div>
        </section>

        {host && (
          <section className="border-b border-line p-4">
            <h2 className="text-[15px] font-semibold">Your host</h2>
            <div className="mt-3 flex items-center gap-3">
              <Avatar initials={host.initials} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[15px] font-semibold">
                  {host.name}
                  {host.verified && <Icon name="shield" size={15} className="text-success" />}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Hosting since {host.since} · responds {host.responseTime}
                </p>
              </div>
              <Button variant="outline" size="sm" icon={<Icon name="phone" size={15} />}>
                Call
              </Button>
            </div>
          </section>
        )}

        {reviews?.length > 0 && (
          <section className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Reviews</h2>
              <span className="flex items-center gap-1 text-[13px] text-muted">
                <Icon name="star" size={14} filled className="text-warning" />
                {spot.rating} · {spot.reviews} reviews
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-[14px] bg-surface p-3.5 card-shadow">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{review.author}</span>
                    <Rating value={review.rating} size={12} />
                    <span className="ml-auto text-[11px] text-muted">{review.when}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{review.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* --------------------------- single primary CTA -------------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-[750] border-t border-line bg-surface/97 px-4 pt-3 pb-[calc(0.75rem+max(0.75rem,env(safe-area-inset-bottom)))] backdrop-blur-sm lg:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-muted">Total from</p>
            <p className="text-[17px] font-bold">
              {money(Math.round(spot.priceHour * 2 * 1.24))}
              <span className="text-[12px] font-medium text-muted"> · 2 hrs</span>
            </p>
          </div>
          <Button
            full
            size="lg"
            className="max-w-[240px]"
            onClick={() => setBookingOpen(true)}
          >
            {spot.availability === 'full' ? 'Join waitlist' : 'Book now'}
          </Button>
        </div>
      </div>

      <BookingSheet open={bookingOpen} onClose={() => setBookingOpen(false)} spot={spot} />
    </PageShell>
  )
}

function featureLabelLocal(id) {
  const map = {
    covered: 'Covered',
    gate: 'Gated',
    cctv: 'CCTV',
    floodlight: 'Floodlights',
    caretaker: 'Caretaker',
    water: 'Water point',
    ev: 'EV charging',
    wide: 'Wide entry',
  }
  return map[id] ?? id
}
