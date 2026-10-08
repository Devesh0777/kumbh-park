import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { metres, money } from '@/lib/format'
import { VEHICLE_TYPES } from '@/api/mock/spots'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { Rating, VerifiedBadge } from '@/components/ui/Bits'

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

/**
 * Deterministically assigns one of 10 Kumbh Park Roadside Parking Sign Variants.
 * Based on spot characteristics (distance, covered, capacity, rating, availability, instant book, type, zone).
 */
export function getSignVariant(spot) {
  // 1. Variant 06: Fast Filling (low remaining spots)
  if (spot.availability === 'filling' && spot.spotsLeft <= 4) {
    return 'FAST_FILLING'
  }
  // 2. Variant 05: Closest to destination (<250m)
  if (spot.distanceM <= 250) {
    return 'CLOSEST'
  }
  // 3. Variant 02: Ghat Proximity (<380m)
  if (spot.distanceM <= 380) {
    return 'GHAT_PROXIMITY'
  }
  // 4. Variant 03: Covered Parking
  if (spot.features?.includes('covered') || spot.clearanceM < 2.8) {
    return 'COVERED'
  }
  // 5. Variant 04: High Capacity lot (>=35 spots)
  if (spot.capacity >= 35) {
    return 'HIGH_CAPACITY'
  }
  // 6. Variant 08: Premium / Top Verified (Rating >= 4.85)
  if (spot.verified && spot.rating >= 4.85) {
    return 'TOP_VERIFIED'
  }
  // 7. Variant 07: Instant QR Booking
  if (spot.instantBook) {
    return 'INSTANT_BOOK'
  }
  // 8. Variant 09: Open Driveway / Compound Lawn
  if (
    spot.title?.toLowerCase().includes('lawn') ||
    spot.title?.toLowerCase().includes('driveway') ||
    spot.title?.toLowerCase().includes('plot') ||
    spot.surface?.toLowerCase().includes('gravel')
  ) {
    return 'OPEN_DRIVEWAY'
  }
  // 9. Variant 10: Event / Kumbh Sector Transit
  if (spot.zone?.short || spot.zone?.name) {
    return 'KUMBH_ZONE'
  }
  // 10. Variant 01: Standard Highway Green
  return 'STANDARD'
}

/**
 * Renders the compact dynamic roadside sign plate with variant-specific styling.
 */
function ParkingSignPlate({ spot, variant }) {
  const isFull = spot.spotsLeft <= 0
  const isFilling = spot.availability === 'filling'
  const ghatName = spot.ghat?.name?.toUpperCase() || 'GHAT'

  switch (variant) {
    // VARIANT 02: GHAT PROXIMITY
    case 'GHAT_PROXIMITY':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#004E30] p-2.5 text-white shadow-sm border-1.5 border-white ring-1 ring-[#004E30]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFD166]">
                <span className="text-[11px]">⚡</span> GHAT ACCESS CORRIDOR
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
                {spot.title}
              </h3>
            </div>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <div className="flex items-center gap-1 rounded bg-[#FFD166] text-[#003822] px-1.5 py-0.2 font-black">
                <span>➔</span>
                <span>{metres(spot.distanceM)} TO {ghatName}</span>
              </div>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 03: COVERED PARKING
    case 'COVERED':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#092B22] p-2.5 text-white shadow-sm border-1.5 border-[#D4ECE1]/80 ring-1 ring-[#092B22]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#9FE1C8]">
                <span>☂</span> COVERED & SHADED BAY
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-[#FAF7F2]/90 font-bold">➔ {metres(spot.distanceM)} · {spot.address?.split(',')[0]}</span>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 04: HIGH CAPACITY
    case 'HIGH_CAPACITY':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#005A36] p-2.5 text-white shadow-sm border-1.5 border-white ring-1 ring-[#005A36]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFD166]">
                <span>☵</span> HIGH-CAPACITY GROUP LOT
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-white/90 font-bold">➔ {metres(spot.distanceM)} TO {ghatName}</span>
              <span className="rounded bg-emerald-500/30 border border-emerald-400 px-1.5 py-0.2 font-black text-[#D4ECE1]">
                {spot.spotsLeft}/{spot.capacity} FREE
              </span>
            </div>
          </div>
        </div>
      )

    // VARIANT 05: CLOSEST
    case 'CLOSEST':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#005433] p-2.5 text-white shadow-sm border-1.5 border-[#FFD166] ring-1 ring-[#FFD166]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFD166] font-black">
                <span>★</span> CLOSEST ROUTE TO GHAT
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <div className="flex items-center gap-1 font-black text-[#FFD166]">
                <span>➔</span>
                <span>{metres(spot.distanceM)} (IMMEDIATE WALK)</span>
              </div>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 06: FAST FILLING
    case 'FAST_FILLING':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#004A2B] p-2.5 text-white shadow-sm border-1.5 border-[#FFA94D] ring-1 ring-[#FFA94D]/50">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFA94D] font-black">
                <span className="size-1.5 rounded-full bg-[#FFA94D] animate-ping" />
                FILLING FAST • RUSH HOUR
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-white/90 font-bold">➔ {metres(spot.distanceM)} TO {ghatName}</span>
              <span className="rounded bg-[#FFA94D] text-[#002B19] px-1.5 py-0.2 font-black">
                ONLY {spot.spotsLeft} LEFT
              </span>
            </div>
          </div>
        </div>
      )

    // VARIANT 07: INSTANT BOOK
    case 'INSTANT_BOOK':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#005A36] p-2.5 text-white shadow-sm border-1.5 border-white ring-1 ring-[#005A36]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#9FE1C8] font-black">
                <Icon name="bolt" size={11} className="text-[#FFD166]" /> INSTANT DIGITAL PASS
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-white/90 font-bold">➔ {metres(spot.distanceM)} · SCAN & PARK</span>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 08: TOP VERIFIED
    case 'TOP_VERIFIED':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#07241C] p-2.5 text-white shadow-sm border-1.5 border-[#FFD166]/80 ring-1 ring-[#07241C]/50">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFD166] font-black">
                <span>✓</span> TOP VERIFIED PREMIER
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-[#FAF7F2]/90 font-bold">➔ {metres(spot.distanceM)} TO {ghatName}</span>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 09: OPEN DRIVEWAY / LAWN
    case 'OPEN_DRIVEWAY':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#00683E] p-2.5 text-white shadow-sm border-1.5 border-white ring-1 ring-[#00683E]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FAF7F2] font-black">
                <span>🏡</span> PRIVATE DRIVEWAY / BAY
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-white/90 font-bold">➔ {metres(spot.distanceM)} · {spot.surface}</span>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 10: EVENT / KUMBH ZONE
    case 'KUMBH_ZONE':
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#005A36] p-2.5 text-white shadow-sm border-1.5 border-white ring-1 ring-[#005A36]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFD166]">
                <span className="size-1.5 rounded-full bg-[#FFD166]" />
                KUMBH 2027 • {spot.zone?.short || 'NASHIK'}
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-white font-bold">➔ {metres(spot.distanceM)} TO {ghatName}</span>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )

    // VARIANT 01: STANDARD GREEN
    default:
      return (
        <div className="relative overflow-hidden rounded-lg bg-[#005A36] p-2.5 text-white shadow-sm border-1.5 border-white ring-1 ring-[#005A36]/40">
          <CornerRivets />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between border-b border-white/20 pb-1 text-[9.5px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-[#FFD166]">
                KUMBH PARK • {spot.zone?.short || 'VERIFIED'}
              </span>
              <span className="text-white font-black">{money(spot.priceHour)}/hr</span>
            </div>
            <h3 className="text-[13px] font-black uppercase font-heading tracking-tight truncate text-white">
              {spot.title}
            </h3>
            <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[10px] font-mono">
              <span className="text-white font-bold">➔ {metres(spot.distanceM)} TO {ghatName}</span>
              <AvailabilityDot isFull={isFull} isFilling={isFilling} left={spot.spotsLeft} total={spot.capacity} />
            </div>
          </div>
        </div>
      )
  }
}

function CornerRivets() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/10" />
      <span className="absolute top-1 left-1 size-1 rounded-full bg-white/90 shadow-2xs" />
      <span className="absolute top-1 right-1 size-1 rounded-full bg-white/90 shadow-2xs" />
      <span className="absolute bottom-1 left-1 size-1 rounded-full bg-white/90 shadow-2xs" />
      <span className="absolute bottom-1 right-1 size-1 rounded-full bg-white/90 shadow-2xs" />
    </>
  )
}

function AvailabilityDot({ isFull, isFilling, left, total }) {
  return (
    <div className="flex items-center gap-1 font-bold">
      <span
        className={cn(
          'size-1.5 rounded-full shrink-0',
          isFull ? 'bg-red-400' : isFilling ? 'bg-[#FFA94D] animate-pulse' : 'bg-emerald-400',
        )}
      />
      <span className="text-[9.5px] uppercase text-white font-mono font-bold">
        {left > 0 ? `${left}/${total} FREE` : 'FULL'}
      </span>
    </div>
  )
}

/**
 * Compact Kumbh Park Parking Sign Card (V2)
 * High-density, scannable roadside signage card with deterministic variant differentiation.
 */
export function ParkingCard({ spot, selected = false, onHover, onSelect, index, animate }) {
  const variant = getSignVariant(spot)
  const isBestValue = spot.priceHour <= 25

  // Primary amenities summary text
  const amenityLabels = []
  if (spot.features?.includes('covered')) amenityLabels.push('Covered')
  if (spot.features?.includes('gate')) amenityLabels.push('Gated')
  if (spot.features?.includes('cctv')) amenityLabels.push('CCTV')
  if (spot.instantBook) amenityLabels.push('Instant QR')
  const amenityText = amenityLabels.slice(0, 3).join(' • ')

  return (
    <div
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border bg-white p-2.5 transition-all duration-150 cursor-pointer',
        selected
          ? 'border-[#006B4F] ring-2 ring-[#006B4F]/40 shadow-md -translate-y-0.5'
          : 'border-[#E2DDD3] shadow-2xs hover:border-[#006B4F] hover:shadow-sm hover:-translate-y-0.5',
        animate && 'card-enter',
      )}
      style={animate ? { '--d': `${Math.min(index, 6) * 30}ms` } : undefined}
    >
      {/* Dynamic Roadside Parking Sign Plate */}
      <ParkingSignPlate spot={spot} variant={variant} />

      {/* Compact Secondary Strip (No duplicated pricing/availability) */}
      <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-[#E2DDD3]/70 text-[11px]">
        {/* Left: Rating, Trust & Amenities */}
        <div className="flex min-w-0 items-center gap-2 truncate">
          <div className="flex items-center gap-1 shrink-0">
            <Rating value={spot.rating} reviews={spot.reviews} size={11} />
            {spot.verified && <VerifiedBadge size={9} />}
          </div>
          {amenityText && (
            <span className="hidden sm:inline-block text-[10.5px] font-semibold text-[#66706B] truncate">
              · {amenityText}
            </span>
          )}
        </div>

        {/* Right: Daily rate & Reserve Spot Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[10.5px] font-mono font-bold text-[#66706B]">
            {money(spot.priceDay)}/day
          </span>

          <Link to={`/listing/${spot.id}`} onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="primary"
              className="bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] font-bold text-[11.5px] px-3.5 py-1 rounded-lg shadow-2xs active:scale-95 transition-all"
            >
              Reserve →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export function ParkingCardWide({ spot, index, animate }) {
  return <ParkingCard spot={spot} index={index} animate={animate} />
}

export default ParkingCard
