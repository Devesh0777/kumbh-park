import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cancelBooking, getMyBookings } from '@/api'
import { dateTime, durationLabel, money, relativeDay, time } from '@/lib/format'
import { BOOKING_STATUS } from '@/lib/status'
import { qrPayload } from '@/lib/id'
import { useAsync } from '@/hooks/useAsync'
import { PageShell, PageHeader } from '@/components/layout/PageShell'
import Photo from '@/components/ui/Photo'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import QRCode from '@/components/ui/QRCode'
import StatusPill from '@/components/ui/StatusPill'
import { SegmentedTabs, TextLink } from '@/components/ui/Chip'
import Sheet from '@/components/ui/Sheet'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import DigitalParkingTicket from '@/components/booking/DigitalParkingTicket'

import QRScannerModal from '@/components/qr/QRScannerModal'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

export default function Bookings() {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('active')
  const [qrFor, setQrFor] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const { data, loading, error, reload } = useAsync(() => getMyBookings(), [])

  const pendingExtraBookings = useMemo(() => {
    return (data ?? []).filter((b) => b.status === 'pending_extra' || b.paymentStatus === 'PENDING_EXTRA')
  }, [data])

  const groups = useMemo(() => {
    const list = data ?? []
    return {
      active: list.filter((b) => b.status === 'active'),
      upcoming: list.filter((b) => b.status === 'upcoming'),
      past: list.filter((b) => b.status === 'completed' || b.status === 'cancelled' || b.status === 'pending_extra'),
    }
  }, [data])

  const items = groups[tab] ?? []

  const doCancel = async () => {
    try {
      await cancelBooking(cancelling.id)
      toast.push({ tone: 'success', title: 'Booking cancelled', message: 'The spot is back on the map.' })
      setCancelling(null)
      reload()
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not cancel', message: err.friendlyMessage ?? err.message })
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="My bookings"
        subtitle="Pilgrim passes, QR check-in and past stays"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (groups.active.length > 0) {
                  setQrFor(groups.active[0])
                } else if (data && data.length > 0) {
                  setQrFor(data[0])
                }
              }}
              className="bg-amber-50 hover:bg-amber-100 text-[#8B5A2B] border border-amber-300 font-bold flex items-center gap-1"
            >
              <span>▶ Run Demo</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 shadow-md bg-[#006B4F]"
            >
              <Icon name="qr" size={16} />
              Scan Spot QR
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {/* Pending Extra Payment Reminder Banner (Part 3) */}
        {pendingExtraBookings.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Icon name="alert-triangle" size={20} />
                <div>
                  <h4 className="text-sm font-bold">Pending Extra Time Payment Due</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    You have late check-out extra charges due for {pendingExtraBookings[0].title}.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                onClick={() => setIsScannerOpen(true)}
              >
                Pay Now
              </Button>
            </div>
          </div>
        )}

        <SegmentedTabs
          tabs={TABS.map((item) => ({ ...item, count: groups[item.id].length }))}
          value={tab}
          onChange={setTab}
        />

        {loading && (
          <div className="mt-4 space-y-3">
            {[0, 1].map((key) => (
              <div key={key} className="h-32 rounded-[var(--radius-card)] bg-surface card-shadow" />
            ))}
          </div>
        )}

        {error && <ErrorState message={error.friendlyMessage} onRetry={reload} className="mt-6" />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon="ticket"
            title={tab === 'active' ? 'No active bookings' : tab === 'upcoming' ? 'Nothing booked yet' : 'No past stays'}
            message="Book a spot near a ghat and your QR pass shows up here."
            action={<Button onClick={() => navigate('/search')}>Find parking</Button>}
          />
        )}

        {/* Only mounted once there is something to show. Rendering the list
            container unconditionally left an empty white block under every
            tab — the skeletons, the empty state and the list were all painted
            at once, so a tab looked like a blank panel. */}
        {!loading && !error && items.length > 0 && (
          <div className="mt-4 space-y-3 pb-4">
            {items.map((booking) => {
              // A status the UI does not know about must not throw — that
              // would take the whole tab down to a white screen.
              const status = BOOKING_STATUS[booking.status] ?? BOOKING_STATUS.upcoming
              return (
                <article
                  key={booking.id}
                  className="overflow-hidden rounded-[var(--radius-card)] bg-surface card-shadow"
                >
                  <div className="flex gap-3 p-3">
                    <Link to={`/listing/${booking.spotId}`} className="shrink-0 group/photo block overflow-hidden rounded-[12px]">
                      <Photo
                        seed={booking.spotId || booking.id}
                        label={booking.zoneName}
                        ratio="aspect-square w-[88px] shrink-0"
                        rounded="rounded-[12px]"
                        className="transition-transform duration-200 group-hover/photo:scale-105"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      {/* Status changes crossfade rather than re-render (spec §4) */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-[14px] font-semibold">{booking.title}</h3>
                        <StatusPill
                          key={booking.status}
                          tone={status.tone}
                          label={status.label}
                          size="sm"
                          className="shrink-0 animate-[fade-in_0.15s_linear]"
                        />
                      </div>

                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                        <Icon name="pin" size={12} />
                        <span className="truncate">{booking.address}</span>
                      </p>

                      <div className="mt-2 space-y-1 text-[12px] text-muted">
                        <p className="flex items-center gap-1.5">
                          <Icon name="calendar" size={12} />
                          {relativeDay(booking.startISO)} · {time(booking.startISO)} → {time(booking.endISO)}
                          <span className="text-muted/70">({durationLabel(booking.hours)})</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Icon name={VEHICLE_ICON[booking.vehicleType]} size={12} />
                          {booking.plate} · {booking.code}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
                    <p className="text-[14px] font-bold">
                      {money(booking.amount)}
                      <span className="ml-1 text-[11px] font-medium text-muted">paid at gate</span>
                    </p>
                    <div className="flex items-center gap-3">
                      {booking.status === 'cancelled' ? (
                        <span className="text-[12px] text-muted">{booking.cancelReason}</span>
                      ) : (
                        <>
                          <TextLink icon={<Icon name="qr" size={14} />} onClick={() => setQrFor(booking)}>
                            QR pass
                          </TextLink>
                          {booking.status === 'upcoming' && (
                            <TextLink className="text-muted" onClick={() => setCancelling(booking)}>
                              Cancel
                            </TextLink>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* QR pass */}
      <Sheet
        open={Boolean(qrFor)}
        onClose={() => setQrFor(null)}
        title="Digital Parking Ticket"
        subtitle={qrFor ? `${qrFor.code} · ${qrFor.plate}` : ''}
        height="tall"
        width="wide"
      >
        {qrFor && (
          <div className="pb-6">
            <DigitalParkingTicket
              booking={qrFor}
              spot={qrFor}
              onClose={() => setQrFor(null)}
              showActions={true}
            />
          </div>
        )}
      </Sheet>

      {/* cancel confirmation */}
      <Sheet
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this booking?"
        subtitle={cancelling?.title}
        height="auto"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" full size="lg" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="danger" full size="lg" onClick={doCancel}>
              Cancel booking
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-muted">
          The spot goes back on the map straight away and other pilgrims can take it. Cancellation is free until
          check-in.
        </p>
      </Sheet>

      {/* QR Scanner Modal for Check-in & Check-out */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={() => reload()}
      />
    </PageShell>
  )
}
