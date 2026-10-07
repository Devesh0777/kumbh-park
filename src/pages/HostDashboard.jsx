import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getHostBookings, getHostListings, getHostSummary, markCheckedIn, markCheckedOut, setAccepting } from '@/api'
import { cn } from '@/lib/cn'
import { money, relativeDay, time } from '@/lib/format'
import { AVAILABILITY, BOOKING_STATUS, VERIFICATION } from '@/lib/status'
import { useAsync } from '@/hooks/useAsync'
import { PageShell, PageHeader } from '@/components/layout/PageShell'
import Photo from '@/components/ui/Photo'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import StatusPill from '@/components/ui/StatusPill'
import { SegmentedTabs } from '@/components/ui/Chip'
import { Toggle } from '@/components/ui/Field'
import { Avatar, Rating } from '@/components/ui/Bits'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useApp } from '@/context/AppContext'
import HostQRCard from '@/components/qr/HostQRCard'

const TABS = [
  { id: 'listings', label: 'Listings' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'payouts', label: 'Payouts' },
]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

export default function HostDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const { host } = useApp()
  const [tab, setTab] = useState('listings')
  const [busyId, setBusyId] = useState(null)
  const [selectedSpotForQr, setSelectedSpotForQr] = useState(null)

  const { data: summary, loading: summaryLoading } = useAsync(() => getHostSummary(), [])
  const { data: listings, loading, error, reload } = useAsync(() => getHostListings(), [])
  const { data: bookings, reload: reloadBookings } = useAsync(() => getHostBookings(), [])

  const counts = useMemo(
    () => ({
      listings: listings?.length ?? 0,
      bookings: bookings?.filter((b) => b.status === 'active' || b.status === 'upcoming').length ?? 0,
      payouts: 0,
    }),
    [listings, bookings],
  )

  const active = bookings?.filter((b) => b.status === 'active') ?? []
  const upcoming = bookings?.filter((b) => b.status === 'upcoming') ?? []
  const history = bookings?.filter((b) => b.status === 'completed' || b.status === 'cancelled') ?? []

  const toggleCheckIn = async (booking) => {
    setBusyId(booking.id)
    try {
      if (booking.status === 'upcoming') {
        await markCheckedIn(booking.id)
        toast.push({ tone: 'success', title: 'Checked in', message: `${booking.plate} is parked at your spot.` })
      } else {
        await markCheckedOut(booking.id)
        toast.push({ tone: 'success', title: 'Checked out', message: `${booking.plate} has left. Spot is free.` })
      }
      reloadBookings()
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not update', message: err.friendlyMessage ?? err.message })
    } finally {
      setBusyId(null)
    }
  }

  const toggleAccepting = async (listing, accepting) => {
    await setAccepting(listing.id, accepting)
    toast.push({
      tone: 'info',
      title: accepting ? 'Accepting bookings' : 'Paused bookings',
      message: accepting ? 'Pilgrims can book you again.' : 'Your listing stays visible but is not bookable.',
    })
    reload()
  }

  return (
    <PageShell>
      <PageHeader
        title="Host dashboard"
        subtitle="Your spots, bookings and earnings"
        actions={
          <Button size="sm" icon={<Icon name="plus" size={15} />} onClick={() => navigate('/host/new')}>
            <span className="hidden sm:inline">Add spot</span>
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {/* host identity */}
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 card-shadow">
          <Avatar initials={host.initials} size={44} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold">
              {host.name}
              <Icon name="shield" size={15} className="text-success" />
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <Rating value={host.rating} reviews={host.reviews} size={12} />
              <span className="text-[12px] text-muted">Hosting since {host.since}</span>
            </div>
          </div>
          <Link
            to="/admin"
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted"
          >
            Admin
          </Link>
        </div>

        {/* summary tiles */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Today" value={summaryLoading ? '—' : money(summary?.earningsToday ?? 0)} accent />
          <Tile label="Checked in" value={summary?.activeBookings ?? 0} />
          <Tile label="Upcoming" value={summary?.upcomingBookings ?? 0} />
          <Tile label="Occupancy" value={`${summary?.occupancy ?? 0}%`} />
        </div>

        <div className="mt-4">
          <SegmentedTabs tabs={TABS.map((item) => ({ ...item, count: counts[item.id] }))} value={tab} onChange={setTab} />
        </div>

        {/* ---------------------------------- listings ----------------------------- */}
        {tab === 'listings' && (
          <div className="mt-4 space-y-3 pb-4">
            {loading && <div className="h-40 rounded-[var(--radius-card)] bg-surface card-shadow" />}
            {error && <ErrorState message={error.friendlyMessage} onRetry={reload} />}
            {(listings ?? []).map((listing) => {
              const availability = AVAILABILITY[listing.availability] ?? AVAILABILITY.available
              const verification = VERIFICATION[listing.verification] ?? VERIFICATION.pending
              return (
                <article key={listing.id} className="overflow-hidden rounded-[var(--radius-card)] bg-surface card-shadow">
                  <div className="flex gap-3 p-3">
                    <Link to={`/listing/${listing.id}`} className="shrink-0">
                      <Photo
                        seed={listing.id}
                        label={listing.zone?.short}
                        ratio="aspect-square w-[84px]"
                        rounded="rounded-[12px]"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/listing/${listing.id}`} className="line-clamp-2 text-[14px] font-semibold">
                          {listing.title}
                        </Link>
                        <StatusPill
                          tone={availability.tone}
                          label={availability.label}
                          pulse={listing.availability === 'filling'}
                          size="sm"
                          className="shrink-0"
                        />
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {listing.zone?.name} · {listing.spotsLeft} of {listing.capacity} free
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StatusPill tone={verification.tone} label={verification.label} size="sm" />
                        <span className="text-[12px] font-semibold">
                          {money(listing.priceHour)}/hr · {money(listing.priceDay)}/day
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Toggle
                        checked={listing.accepting}
                        onChange={(value) => toggleAccepting(listing, value)}
                        label={listing.accepting ? 'Accepting bookings' : 'Paused'}
                        tone="success"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedSpotForQr(selectedSpotForQr?.id === listing.id ? null : listing)}
                      className="flex items-center gap-1 text-xs"
                    >
                      <Icon name="qr" size={14} />
                      {selectedSpotForQr?.id === listing.id ? 'Hide QR' : 'Spot QR Plaque'}
                    </Button>
                    <span className="shrink-0 text-right text-[12px]">
                      <span className="block font-bold">{money(listing.earnings)}</span>
                      <span className="text-muted">earned total</span>
                    </span>
                  </div>

                  {selectedSpotForQr?.id === listing.id && (
                    <div className="p-3 border-t border-line bg-surface-raised animate-in fade-in">
                      <HostQRCard spot={listing} />
                    </div>
                  )}
                </article>
              )
            })}

            <Button
              full
              variant="outline"
              size="lg"
              icon={<Icon name="plus" size={16} />}
              onClick={() => navigate('/host/new')}
            >
              List another spot
            </Button>
          </div>
        )}

        {/* ---------------------------------- bookings ----------------------------- */}
        {tab === 'bookings' && (
          <div className="mt-4 space-y-5 pb-4">
            <BookingGroup title="At your gate now" bookings={active} busyId={busyId} onToggle={toggleCheckIn} />
            <BookingGroup title="Arriving soon" bookings={upcoming} busyId={busyId} onToggle={toggleCheckIn} />
            <BookingGroup title="History" bookings={history} busyId={busyId} onToggle={toggleCheckIn} muted />
            {(bookings ?? []).length === 0 && (
              <EmptyState icon="calendar" title="No bookings yet" message="Guest bookings for your spots show up here." />
            )}
          </div>
        )}

        {/* ---------------------------------- payouts ------------------------------ */}
        {tab === 'payouts' && (
          <div className="mt-4 space-y-3 pb-4">
            <div className="rounded-[var(--radius-card)] bg-surface p-4 card-shadow">
              <p className="text-[13px] font-semibold text-muted">Available to withdraw</p>
              <p className="mt-1 text-[28px] font-bold">{money(summary?.earningsToday ?? 0)}</p>
              <p className="mt-1 text-[12px] text-muted">Settled every Monday to your registered UPI ID.</p>
              <Button full size="lg" className="mt-3" icon={<Icon name="wallet" size={16} />}>
                Withdraw to UPI
              </Button>
            </div>
            <div className="rounded-[var(--radius-card)] bg-surface p-4 card-shadow">
              <p className="text-[14px] font-semibold">This month</p>
              <ul className="mt-2 space-y-2 text-[13px]">
                <li className="flex justify-between">
                  <span className="text-muted">Gross bookings</span>
                  <span className="font-semibold">{money(24100)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted">Platform fee (6%)</span>
                  <span className="font-semibold">− {money(1446)}</span>
                </li>
                <li className="flex justify-between border-t border-line pt-2 text-[15px] font-bold">
                  <span>Net earnings</span>
                  <span>{money(22654)}</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function BookingGroup({ title, bookings, onToggle, busyId, muted }) {
  if (!bookings.length) return null
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold text-muted">{title}</h2>
      <div className="space-y-2">
        {bookings.map((booking) => {
          const status = BOOKING_STATUS[booking.status]
          const canToggle = booking.status === 'active' || booking.status === 'upcoming'
          return (
            <div
              key={booking.id}
              className={cn(
                'flex items-center gap-3 rounded-[14px] bg-surface p-3 card-shadow',
                muted && 'opacity-80',
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-muted">
                <Icon name={VEHICLE_ICON[booking.vehicleType]} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{booking.plate}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted">
                  {relativeDay(booking.startISO)} · {time(booking.startISO)} → {time(booking.endISO)} ·{' '}
                  {money(booking.amount)}
                </p>
              </div>
              {canToggle ? (
                <Button
                  size="sm"
                  variant={booking.status === 'upcoming' ? 'primary' : 'outline'}
                  loading={busyId === booking.id}
                  onClick={() => onToggle(booking)}
                >
                  {booking.status === 'upcoming' ? 'Check in' : 'Check out'}
                </Button>
              ) : (
                <StatusPill tone={status.tone} label={status.label} size="sm" />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Tile({ label, value, accent }) {
  return (
    <div className={cn('rounded-[var(--radius-card)] p-3.5 card-shadow', accent ? 'bg-text text-white' : 'bg-surface')}>
      <p className={cn('text-[11px] font-semibold', accent ? 'text-white/60' : 'text-muted')}>{label}</p>
      <p className="mt-1 text-[19px] font-bold">{value}</p>
    </div>
  )
}
