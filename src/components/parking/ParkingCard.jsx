import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { metres, money } from '@/lib/format'
import { AVAILABILITY } from '@/lib/status'
import { VEHICLE_TYPES } from '@/api/mock/spots'
import Icon from '@/components/ui/Icon'
import Photo from '@/components/ui/Photo'
import StatusPill from '@/components/ui/StatusPill'
import { Rating, VerifiedBadge } from '@/components/ui/Bits'

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

function SpotsLeft({ spot }) {
  if (spot.availability === 'full') return <span className="text-[12px] font-medium text-danger">No spots</span>
  if (spot.availability === 'filling')
    return (
      <span className="text-[12px] font-medium text-warning">
        {spot.spotsLeft} of {spot.capacity} left
      </span>
    )
  return (
    <span className="text-[12px] font-medium text-success">
      {spot.spotsLeft} of {spot.capacity} free
    </span>
  )
}

function PriceTag({ spot, plan }) {
  const hourly = plan === 'hour'
  return (
    <div className="text-right leading-tight">
      <p className="text-[15px] font-bold">
        {money(hourly ? spot.priceHour : spot.priceDay)}
        <span className="text-[12px] font-medium text-muted">{hourly ? '/hr' : '/day'}</span>
      </p>
      <p className="text-[11px] text-muted">{money(hourly ? spot.priceDay : spot.priceHour * 10)} other plan</p>
    </div>
  )
}

/** Horizontal result card — the Ola/Uber list row used on Search and Home. */
export function ParkingCard({ spot, plan = 'hour', selected = false, onHover, onSelect, index, animate }) {
  const availability = AVAILABILITY[spot.availability] ?? AVAILABILITY.available

  return (
    <Link
      to={`/listing/${spot.id}`}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        'flex gap-3 rounded-[var(--radius-card)] bg-surface p-2.5 card-shadow',
        'transition-all duration-200 [transition-timing-function:var(--ease-out-expo)]',
        'hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]',
        selected && 'ring-2 ring-accent',
        animate && 'card-enter',
      )}
      style={animate ? { '--d': `${Math.min(index, 8) * 40}ms` } : undefined}
    >
      <Photo
        seed={spot.id}
        label={spot.zone?.short ?? 'NASHIK'}
        ratio="aspect-[1/1] w-[104px] shrink-0 sm:w-[132px]"
        rounded="rounded-[12px]"
        className="self-start"
      >
        <div className="absolute top-1.5 left-1.5">
          <StatusPill tone={availability.tone} label={availability.label} pulse={spot.availability === 'filling'} size="sm" />
        </div>
      </Photo>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-[14px] leading-snug font-semibold">{spot.title}</h3>
        </div>

        <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
          <Icon name="pin" size={12} />
          <span className="truncate">
            {metres(spot.distanceM)} from {spot.ghat?.name ?? 'ghat'}
          </span>
        </p>

        <div className="mt-1.5 flex items-center gap-2.5">
          <Rating value={spot.rating} reviews={spot.reviews} size={12} />
          {spot.verified && <VerifiedBadge size={11} />}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {spot.vehicles.map((vehicle) => {
            const type = VEHICLE_TYPES.find((v) => v.id === vehicle)
            return (
              <span
                key={vehicle}
                title={type?.label}
                className="grid size-5 place-items-center rounded-full bg-surface-sunken text-muted"
              >
                <Icon name={VEHICLE_ICON[vehicle]} size={12} />
              </span>
            )
          })}
          <span className="text-[11px] text-muted">
            · {spot.distanceKm ? `${metres(spot.distanceKm * 1000)} away` : `${metres(spot.distanceM)} from ghat`}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="min-w-0">
            <SpotsLeft spot={spot} />
            {spot.instantBook && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-success">
                <Icon name="bolt" size={11} />
                Instant book
              </p>
            )}
          </div>
          <PriceTag spot={spot} plan={plan} />
        </div>
      </div>
    </Link>
  )
}

/** Vertical card used for the Home preview rail. */
export function ParkingCardWide({ spot, index, animate }) {
  const availability = AVAILABILITY[spot.availability] ?? AVAILABILITY.available
  return (
    <Link
      to={`/listing/${spot.id}`}
      className={cn(
        'w-[260px] shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-surface card-shadow',
        'transition-transform duration-200 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98]',
        animate && 'card-enter',
      )}
      style={animate ? { '--d': `${index * 40}ms` } : undefined}
    >
      <Photo seed={spot.id} label={spot.zone?.short ?? 'NASHIK'} ratio="aspect-[16/9]" rounded="rounded-none">
        <div className="absolute top-2 left-2">
          <StatusPill tone={availability.tone} label={availability.label} pulse={spot.availability === 'filling'} size="sm" />
        </div>
      </Photo>
      <div className="p-3">
        <h3 className="truncate text-[14px] font-semibold">{spot.title}</h3>
        <p className="mt-1 truncate text-[12px] text-muted">
          {spot.zone?.name} · {metres(spot.distanceM)} from ghat
        </p>
        <div className="mt-2 flex items-end justify-between">
          <Rating value={spot.rating} reviews={spot.reviews} size={12} />
          <p className="text-[14px] font-bold">
            {money(spot.priceHour)}
            <span className="text-[11px] font-medium text-muted">/hr</span>
          </p>
        </div>
      </div>
    </Link>
  )
}

export default ParkingCard
