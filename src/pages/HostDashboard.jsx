import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getHostBookings, getHostListings, getHostSummary, markCheckedIn, markCheckedOut, setAccepting } from '@/api'
import { cn } from '@/lib/cn'
import { money, relativeDay, time } from '@/lib/format'
import { AVAILABILITY, BOOKING_STATUS, VERIFICATION } from '@/lib/status'
import { useAsync } from '@/hooks/useAsync'
import { PageShell } from '@/components/layout/PageShell'
import Photo from '@/components/ui/Photo'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import StatusPill from '@/components/ui/StatusPill'
import { Toggle } from '@/components/ui/Field'
import { Avatar, Rating } from '@/components/ui/Bits'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useApp } from '@/context/AppContext'
import HostQRCard from '@/components/qr/HostQRCard'

const TABS = [
  { id: 'listings', label: 'Parking Assets' },
  { id: 'bookings', label: 'Gate Bookings' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'payouts', label: 'UPI Settlements' },
]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

// 7-day revenue performance profile
const WEEKLY_EARNINGS = [
  { day: 'Wed', date: 'Oct 01', amount: 840, bookings: 7, occupancy: 58 },
  { day: 'Thu', date: 'Oct 02', amount: 1120, bookings: 9, occupancy: 68 },
  { day: 'Fri', date: 'Oct 03', amount: 1450, bookings: 12, occupancy: 82 },
  { day: 'Sat', date: 'Oct 04', amount: 1980, bookings: 16, occupancy: 94, peak: true },
  { day: 'Sun', date: 'Oct 05', amount: 1850, bookings: 15, occupancy: 91 },
  { day: 'Mon', date: 'Oct 06', amount: 960, bookings: 8, occupancy: 60 },
  { day: 'Today', date: 'Oct 07', amount: 1274, bookings: 10, occupancy: 78, current: true },
]

// Pilgrim demand & occupancy profile by hour
const HOURLY_OCCUPANCY = [
  { hour: '04:00', label: '4 AM', rate: 45, note: 'Brahma Muhurta' },
  { hour: '06:00', label: '6 AM', rate: 88, note: 'Morning Snan Peak', peak: true },
  { hour: '08:00', label: '8 AM', rate: 94, note: 'Temple Darshan', peak: true },
  { hour: '10:00', label: '10 AM', rate: 76 },
  { hour: '12:00', label: '12 PM', rate: 60, note: 'Midday Lull' },
  { hour: '14:00', label: '2 PM', rate: 52, note: 'Afternoon Dip' },
  { hour: '16:00', label: '4 PM', rate: 70 },
  { hour: '18:00', label: '6 PM', rate: 92, note: 'Godavari Aarti Peak', peak: true },
  { hour: '20:00', label: '8 PM', rate: 82, note: 'Evening Movement' },
  { hour: '22:00', label: '10 PM', rate: 38 },
]

// Parking utilization breakdown
const UTILIZATION_SLICES = [
  { label: 'Booked', percent: 62, count: '8 bays', color: '#075B3D' },
  { label: 'Available', percent: 22, count: '3 bays', color: '#2E7D46' },
  { label: 'Reserved', percent: 10, count: '1 bay', color: '#E6B84A' },
  { label: 'Offline / Buffer', percent: 6, count: '—', color: '#64748B' },
]

export default function HostDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const { host } = useApp()
  const [tab, setTab] = useState('listings')
  const [busyId, setBusyId] = useState(null)
  const [selectedSpotForQr, setSelectedSpotForQr] = useState(null)
  const [hoveredDay, setHoveredDay] = useState(null)
  const [hoveredHour, setHoveredHour] = useState(null)

  const { data: summary, loading: summaryLoading } = useAsync(() => getHostSummary(), [])
  const { data: listings, loading, error, reload } = useAsync(() => getHostListings(), [])
  const { data: bookings, reload: reloadBookings } = useAsync(() => getHostBookings(), [])

  const counts = useMemo(
    () => ({
      listings: listings?.length ?? 0,
      bookings: bookings?.filter((b) => b.status === 'active' || b.status === 'upcoming').length ?? 0,
      activity: bookings?.length ?? 0,
      payouts: 0,
    }),
    [listings, bookings],
  )

  const active = bookings?.filter((b) => b.status === 'active') ?? []
  const upcoming = bookings?.filter((b) => b.status === 'upcoming') ?? []
  const history = bookings?.filter((b) => b.status === 'completed' || b.status === 'cancelled') ?? []

  // Synthesize recent gate event timeline
  const activityFeed = useMemo(() => {
    const list = []
    for (const b of active) {
      list.push({
        id: `act-${b.id}-in`,
        type: 'CHECKED IN',
        plate: b.plate,
        title: b.title,
        time: time(b.checkedInISO || b.startISO),
        tone: 'success',
        desc: `Vehicle checked in via QR scan at compound gate.`,
      })
    }
    for (const b of upcoming) {
      list.push({
        id: `act-${b.id}-book`,
        type: 'BOOKED',
        plate: b.plate,
        title: b.title,
        time: time(b.createdISO || b.startISO),
        tone: 'warning',
        desc: `New prepaid reservation confirmed for ${relativeDay(b.startISO)}, ${time(b.startISO)}.`,
      })
    }
    for (const b of history.slice(0, 4)) {
      list.push({
        id: `act-${b.id}-out`,
        type: b.status === 'cancelled' ? 'CANCELLED' : 'CHECKED OUT',
        plate: b.plate,
        title: b.title,
        time: time(b.checkedOutISO || b.endISO),
        tone: b.status === 'cancelled' ? 'danger' : 'neutral',
        desc: b.status === 'cancelled' ? `Pilgrim cancelled slot before arrival.` : `Vehicle completed stay. Tariff settled.`,
      })
    }
    return list
  }, [active, upcoming, history])

  const toggleCheckIn = async (booking) => {
    setBusyId(booking.id)
    try {
      if (booking.status === 'upcoming') {
        await markCheckedIn(booking.id)
        toast.push({ tone: 'success', title: 'Checked in', message: `${booking.plate} is now parked at your compound.` })
      } else {
        await markCheckedOut(booking.id)
        toast.push({ tone: 'success', title: 'Checked out', message: `${booking.plate} has vacated the bay.` })
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
      message: accepting ? 'Pilgrims can now reserve your parking bays.' : 'Your listing is temporarily paused.',
    })
    reload()
  }

  return (
    <PageShell>
      {/* ----------------- LIGHT KUMBH PARK OPERATIONS DASHBOARD HEADER ----------------- */}
      <div className="border-b border-[#E8E4DA] bg-[#F7F4ED] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            {/* Host Identity with Human Vector Icon & Badges */}
            <div className="flex items-center gap-4">
              <Avatar size={54} tone="sage" className="ring-2 ring-[#075B3D]/20 shadow-xs" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[20px] sm:text-[22px] font-black tracking-tight text-[#17212B] font-heading">
                    {host.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#E7F1EA] px-2.5 py-0.5 text-[10.5px] font-black text-[#075B3D] uppercase tracking-wider font-mono border border-[#075B3D]/25">
                    <Icon name="shield" size={11} strokeWidth={2.5} />
                    VERIFIED HOST
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6B6B6B]">
                  <Rating value={host.rating} reviews={host.reviews} size={13} />
                  <span>•</span>
                  <span>Hosting since {host.since}</span>
                  <span>•</span>
                  <span className="text-[#075B3D] font-bold">Avg response {host.responseTime}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions: Warm Saffron/Amber Primary CTA */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                size="md"
                variant="primary"
                icon={<Icon name="plus" size={16} strokeWidth={2.6} />}
                onClick={() => navigate('/host/new')}
                className="bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] font-bold text-[13px] shadow-sm px-4 cursor-pointer"
              >
                + Add Parking Bay
              </Button>
              <Link
                to="/admin"
                className="rounded-xl border border-[#E2DDD3] bg-white px-3.5 py-2 text-[12px] font-bold text-[#17212B] hover:bg-[#FAF7F2] transition-all shadow-2xs"
              >
                Admin Control Room
              </Link>
            </div>
          </div>

          {/* ---------------- 4 LIGHT OPERATIONS METRIC CARDS ---------------- */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Metric 1: Today's Earnings (Green Accent + Upward Trend) */}
            <div className="rounded-2xl border border-[#075B3D]/30 bg-white p-4 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                  TODAY'S EARNINGS
                </span>
                <span className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-[#075B3D] bg-[#E7F1EA] px-1.5 py-0.5 rounded">
                  <Icon name="trendUp" size={11} strokeWidth={2.4} />
                  +18%
                </span>
              </div>
              <p className="mt-1.5 text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                {summaryLoading ? '—' : money(summary?.earningsToday ?? 1463)}
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#075B3D]">
                <span className="size-2 rounded-full bg-[#075B3D] animate-pulse" />
                <span>Live settled today</span>
              </div>
            </div>

            {/* Metric 2: Compound Occupancy (Sage Accent + Progress Meter) */}
            <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B]">
                  COMPOUND OCCUPANCY
                </span>
                <span className="text-[11px] font-mono font-bold text-[#17212B]">
                  9 / 12 Free
                </span>
              </div>
              <p className="mt-1.5 text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                {summary?.occupancy ?? 78}%
              </p>
              {/* Mini Horizontal Occupancy Meter */}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E7F1EA]">
                <div
                  className="h-full bg-gradient-to-r from-[#0B7651] to-[#075B3D] rounded-full transition-all duration-500"
                  style={{ width: `${summary?.occupancy ?? 78}%` }}
                />
              </div>
            </div>

            {/* Metric 3: Active at Gate (Navy Accent + Gate Count) */}
            <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B]">
                  ACTIVE AT GATE
                </span>
                <span className="text-[10px] font-mono font-bold text-[#17212B] bg-[#E8E4DA] px-1.5 py-0.5 rounded">
                  In Compound
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                  {summary?.activeBookings ?? active.length}
                </p>
                <span className="text-[11px] font-bold text-[#075B3D]">Parked Now</span>
              </div>
              <p className="mt-2.5 text-[11px] text-[#6B6B6B] truncate">
                Verified digital gate passes
              </p>
            </div>

            {/* Metric 4: Upcoming Arrivals (Saffron Accent + Arrival Timeline) */}
            <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B]">
                  UPCOMING ARRIVALS
                </span>
                <span className="text-[10px] font-mono font-bold text-[#B47C10] bg-[#FFF8E7] border border-[#E6B84A]/30 px-1.5 py-0.5 rounded">
                  ~45m
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                  {summary?.upcomingBookings ?? upcoming.length}
                </p>
                <span className="text-[11px] font-bold text-[#D99A2B]">Next arriving</span>
              </div>
              <p className="mt-2.5 text-[11px] text-[#6B6B6B] truncate">
                Pre-allocated arrivals
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {/* =========================================================================
            DATA VISUALIZATION: 7-DAY EARNINGS + HOURLY OCCUPANCY GRAPHS
        ========================================================================= */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* 7-Day Revenue Trend Chart (Deep Green + Soft Green Area + Interactive Tooltips) */}
          <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-3">
              <div>
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                  REVENUE PERFORMANCE
                </span>
                <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                  7-Day Earnings Trajectory
                </h3>
              </div>
              <span className="rounded-lg bg-[#E7F1EA] px-2.5 py-1 text-[12px] font-mono font-black text-[#075B3D]">
                ₹9,474 Total
              </span>
            </div>

            {/* Polished Revenue Area/Bar Visualizer */}
            <div className="pt-2">
              <div className="relative flex h-40 items-end justify-between gap-2 sm:gap-3 px-2">
                {/* Horizontal guide lines */}
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#E8E4DA]" />
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#E8E4DA]" />

                {WEEKLY_EARNINGS.map((item, idx) => {
                  const maxAmt = 2000
                  const heightPercent = Math.round((item.amount / maxAmt) * 100)
                  const isHovered = hoveredDay?.day === item.day

                  return (
                    <div
                      key={item.day}
                      onMouseEnter={() => setHoveredDay(item)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className="group relative flex flex-1 flex-col items-center h-full justify-end cursor-pointer z-10"
                    >
                      {/* Interactive Rich Tooltip on Hover */}
                      {isHovered && (
                        <div className="pointer-events-none absolute -top-16 z-30 rounded-xl bg-[#17212B] p-2.5 text-white shadow-lg whitespace-nowrap animate-[pop-in_0.15s_ease-out]">
                          <p className="text-[10px] font-mono uppercase text-[#E6B84A] font-bold">
                            {item.day} • {item.date}
                          </p>
                          <p className="text-[13px] font-black font-mono mt-0.5">
                            {money(item.amount)}
                          </p>
                          <p className="text-[10px] text-white/80 font-mono">
                            {item.bookings} bookings • {item.occupancy}% occupancy
                          </p>
                        </div>
                      )}

                      {/* Bar with Saffron Peak Badge & Kumbh Green treatment */}
                      <div className="w-full relative flex flex-col items-center justify-end h-full">
                        {item.peak && (
                          <span className="absolute -top-5 text-[10px] font-bold text-[#D99A2B] bg-[#FFF8E7] px-1 rounded border border-[#E6B84A]/30">
                            ★ Peak
                          </span>
                        )}
                        <div
                          className={cn(
                            'w-full rounded-t-xl transition-all duration-300',
                            item.peak
                              ? 'bg-gradient-to-t from-[#0B7651] to-[#E6B84A] shadow-xs'
                              : item.current
                                ? 'bg-[#075B3D] ring-2 ring-[#075B3D]/30'
                                : 'bg-[#DDE9E1] hover:bg-[#0B7651] group-hover:bg-[#075B3D]',
                          )}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      {/* X-axis Label */}
                      <span
                        className={cn(
                          'mt-2 text-[11px] font-mono font-bold transition-colors',
                          item.current ? 'text-[#075B3D]' : 'text-[#6B6B6B]',
                        )}
                      >
                        {item.day}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between border-t border-[#E8E4DA] pt-2.5 text-[11px] text-[#6B6B6B]">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#E6B84A]" />
                  Saturday generated highest revenue (+38% pilgrimage peak).
                </span>
                <span className="font-bold text-[#17212B] font-mono">Daily Avg: ₹1,353</span>
              </div>
            </div>
          </div>

          {/* Occupancy by Hour (Demand Curve with Event Milestones) */}
          <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-3">
              <div>
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                  PILGRIM DEMAND PROFILE
                </span>
                <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                  Occupancy by Hour
                </h3>
              </div>
              <span className="rounded-md bg-[#FFF8E7] text-[#B47C10] border border-[#E6B84A]/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                Peak: Aarti & Snan
              </span>
            </div>

            {/* Hourly Occupancy Micro-Bars */}
            <div className="space-y-2 pt-1 max-h-[175px] overflow-y-auto no-scrollbar">
              {HOURLY_OCCUPANCY.map((h) => {
                const isHovered = hoveredHour?.hour === h.hour
                return (
                  <div
                    key={h.hour}
                    onMouseEnter={() => setHoveredHour(h)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className={cn(
                      'flex items-center gap-2.5 text-[11px] p-1 rounded-lg transition-colors cursor-default',
                      isHovered ? 'bg-[#FAF7F2]' : '',
                    )}
                  >
                    <span className="w-10 font-mono font-bold text-[#6B6B6B] shrink-0">{h.label}</span>
                    <div className="relative flex-1 h-3 rounded-full bg-[#E7F1EA] overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          h.peak ? 'bg-[#075B3D]' : 'bg-[#0B7651]/80',
                        )}
                        style={{ width: `${h.rate}%` }}
                      />
                    </div>
                    <span className="w-9 text-right font-mono font-black text-[#17212B] shrink-0">
                      {h.rate}%
                    </span>
                    {h.note && (
                      <span
                        className={cn(
                          'hidden sm:inline text-[9.5px] font-bold shrink-0 truncate max-w-[105px] px-1.5 py-0.2 rounded',
                          h.peak ? 'bg-[#FFF8E7] text-[#B47C10]' : 'text-[#6B6B6B]',
                        )}
                      >
                        {h.note}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* =========================================================================
            ROW 2: NEW VISUALS — PARKING UTILIZATION DONUT & PERFORMANCE INSIGHT
        ========================================================================= */}
        <div className="grid gap-5 sm:grid-cols-12">
          {/* Parking Utilization Breakdown Visual */}
          <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs sm:col-span-6 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-2.5">
              <h3 className="text-[15px] font-black text-[#17212B] font-heading">
                Parking Utilization
              </h3>
              <span className="text-[11px] font-mono font-bold text-[#075B3D]">
                12 Compound Bays
              </span>
            </div>

            <div className="flex items-center gap-5 pt-1">
              {/* Radial Donut Visualization */}
              <div className="relative size-28 shrink-0">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                  {/* Background Circle */}
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E7F1EA"
                    strokeWidth="3.8"
                  />
                  {/* Slices: Booked (62%), Available (22%), Reserved (10%), Offline (6%) */}
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#075B3D"
                    strokeWidth="3.8"
                    strokeDasharray="62, 100"
                    strokeDashoffset="0"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#2E7D46"
                    strokeWidth="3.8"
                    strokeDasharray="22, 100"
                    strokeDashoffset="-62"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E6B84A"
                    strokeWidth="3.8"
                    strokeDasharray="10, 100"
                    strokeDashoffset="-84"
                  />
                </svg>
                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[17px] font-black font-mono text-[#17212B] leading-none">
                    78%
                  </span>
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#6B6B6B] mt-0.5">
                    Occupied
                  </span>
                </div>
              </div>

              {/* Legend & Breakdown */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 flex-1 text-[11px]">
                {UTILIZATION_SLICES.map((slice) => (
                  <div key={slice.label} className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                      <span className="text-[#6B6B6B] truncate">{slice.label}</span>
                    </div>
                    <p className="font-mono font-black text-[#17212B] pl-3.5">
                      {slice.percent}% <span className="text-[9.5px] font-normal text-[#6B6B6B]">({slice.count})</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compact Host Performance Insight Panel */}
          <div className="rounded-3xl border border-[#E8E4DA] bg-[#FAF7F2] p-5 shadow-2xs sm:col-span-6 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF8E7] border border-[#E6B84A]/40 px-2 py-0.5 text-[10px] font-mono font-black text-[#B47C10] uppercase tracking-wider">
                  <Icon name="bulb" size={11} strokeWidth={2.4} />
                  THIS WEEK'S INSIGHT
                </span>
                <span className="text-[11px] font-mono font-bold text-[#075B3D]">
                  High Occupancy Velocity
                </span>
              </div>
              <h4 className="mt-2 text-[14px] font-black text-[#17212B] font-heading">
                Saturday generated highest weekly revenue (₹1,980 with 16 bookings).
              </h4>
              <p className="mt-1 text-[12px] text-[#4A4A4A] leading-relaxed">
                Your Ramkund compound reached 94% peak utilization during the morning Brahma Muhurta & Snan window. Pilgrims reserved slots an average of 3 hours in advance.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-[#E8E4DA] pt-2 text-[11px] text-[#6B6B6B]">
              <span className="font-semibold text-[#075B3D]">✓ Recommended: Keep accepting instant bookings</span>
              <span className="font-mono font-bold text-[#17212B]">Rating: 4.9 ★</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            STRUCTURED CLEAN TEXT NAVIGATION TABS (ACTIVE GREEN UNDERLINE + COUNT)
        ========================================================================= */}
        <div className="border-b border-[#E8E4DA] pt-2">
          <nav className="flex items-center gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
            {TABS.map((item) => {
              const count = counts[item.id]
              const isActive = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'relative flex items-center gap-2 pb-3 pt-1 text-[13px] font-bold transition-colors whitespace-nowrap cursor-pointer',
                    isActive
                      ? 'text-[#075B3D] font-black after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-[#075B3D] after:rounded-full'
                      : 'text-[#6B6B6B] hover:text-[#17212B]',
                  )}
                >
                  <span>{item.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-mono font-black',
                        isActive ? 'bg-[#E7F1EA] text-[#075B3D]' : 'bg-[#E8E4DA] text-[#6B6B6B]',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* =========================================================================
            TAB 1: PARKING ASSETS & PERFORMANCE
        ========================================================================= */}
        {tab === 'listings' && (
          <div className="space-y-4">
            {loading && <div className="h-44 rounded-2xl bg-white border border-[#E8E4DA] animate-pulse" />}
            {error && <ErrorState message={error.friendlyMessage} onRetry={reload} />}

            {(listings ?? []).map((listing) => {
              const availability = AVAILABILITY[listing.availability] ?? AVAILABILITY.available
              const verification = VERIFICATION[listing.verification] ?? VERIFICATION.pending

              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-3xl border border-[#E8E4DA] bg-white shadow-2xs transition-all duration-200 hover:shadow-sm"
                >
                  {/* Asset Header Strip */}
                  <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E8E4DA] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 font-mono font-bold text-[#075B3D] uppercase tracking-wider">
                      <span>ASSET #{listing.id.toUpperCase()}</span>
                      <span>•</span>
                      <span>SECTOR {listing.zone?.short ?? 'NASHIK'}</span>
                    </div>
                    <StatusPill tone={verification.tone} label={verification.label} size="sm" />
                  </div>

                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start justify-between">
                    <div className="flex gap-4 items-start min-w-0">
                      <Link to={`/listing/${listing.id}`} className="shrink-0">
                        <Photo
                          seed={listing.id}
                          label={listing.zone?.short}
                          ratio="aspect-square w-20 sm:w-24"
                          rounded="rounded-2xl"
                        />
                      </Link>

                      <div className="min-w-0 space-y-1">
                        <Link
                          to={`/listing/${listing.id}`}
                          className="text-[16px] font-black text-[#17212B] font-heading hover:text-[#075B3D] transition-colors block truncate"
                        >
                          {listing.title}
                        </Link>
                        <p className="text-[12px] font-medium text-[#6B6B6B] truncate">
                          {listing.address || `${listing.zone?.name} Zone`}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <StatusPill
                            tone={availability.tone}
                            label={availability.label}
                            pulse={listing.availability === 'filling'}
                            size="sm"
                          />
                          <span className="text-[12px] font-bold text-[#17212B]">
                            {listing.spotsLeft} of {listing.capacity} bays free
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tariff & Revenue Mini Box */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8E4DA]">
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] font-bold text-[#6B6B6B] uppercase block">
                          Tariff Rate
                        </span>
                        <span className="text-[15px] font-black font-mono text-[#17212B]">
                          {money(listing.priceHour)}/hr • {money(listing.priceDay)}/day
                        </span>
                      </div>
                      <div className="text-right mt-1">
                        <span className="text-[11px] font-bold text-[#6B6B6B] uppercase block">
                          Total Earned
                        </span>
                        <span className="text-[18px] font-black font-mono text-[#075B3D]">
                          {money(listing.earnings || 2450)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Asset Control Panel Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E4DA] bg-[#FAF7F2]/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Toggle
                        checked={listing.accepting}
                        onChange={(value) => toggleAccepting(listing, value)}
                        label={listing.accepting ? 'Accepting Live Bookings' : 'Bookings Paused'}
                        tone="success"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedSpotForQr(selectedSpotForQr?.id === listing.id ? null : listing)}
                        className="font-bold text-[12px] bg-white border border-[#E8E4DA] shadow-2xs hover:border-[#075B3D]"
                        icon={<Icon name="qr" size={14} />}
                      >
                        {selectedSpotForQr?.id === listing.id ? 'Close Plaque' : 'Spot QR Plaque'}
                      </Button>
                      <Link to={`/listing/${listing.id}`}>
                        <Button size="sm" variant="outline" className="text-[12px] font-bold bg-white hover:bg-[#FAF7F2]">
                          Public View →
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Expandable Spot QR Plaque */}
                  {selectedSpotForQr?.id === listing.id && (
                    <div className="p-4 border-t-2 border-[#075B3D] bg-[#FAF7F2] animate-in fade-in">
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
              icon={<Icon name="plus" size={16} strokeWidth={2.4} />}
              onClick={() => navigate('/host/new')}
              className="border-2 border-dashed border-[#CBD5E1] py-4 font-bold text-[#17212B] hover:border-[#075B3D] hover:bg-white transition-all rounded-3xl"
            >
              List Another Compound or Parking Bay
            </Button>
          </div>
        )}

        {/* =========================================================================
            TAB 2: GATE OPERATIONS & BOOKINGS
        ========================================================================= */}
        {tab === 'bookings' && (
          <div className="space-y-6">
            <BookingGroup title="Currently Parked At Gate" bookings={active} busyId={busyId} onToggle={toggleCheckIn} tone="active" />
            <BookingGroup title="Incoming Reservations" bookings={upcoming} busyId={busyId} onToggle={toggleCheckIn} tone="upcoming" />
            <BookingGroup title="Completed Stays & History" bookings={history} busyId={busyId} onToggle={toggleCheckIn} muted />
            {(bookings ?? []).length === 0 && (
              <EmptyState icon="calendar" title="No bookings active" message="Guest reservations for your bays will populate here." />
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: RECENT ACTIVITY AUDIT LOG
        ========================================================================= */}
        {tab === 'activity' && (
          <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-3">
              <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                Recent Gate Activity Log
              </h3>
              <span className="text-[11px] font-mono font-bold text-[#6B6B6B] uppercase">
                Real-Time Gate Events
              </span>
            </div>

            <div className="divide-y divide-[#E8E4DA]/70">
              {activityFeed.map((item) => (
                <div key={item.id} className="py-3.5 flex items-start justify-between gap-3 text-[13px]">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase tracking-wider',
                        item.tone === 'success'
                          ? 'bg-[#E7F1EA] text-[#075B3D]'
                          : item.tone === 'warning'
                            ? 'bg-[#FFF8E7] text-[#B47C10]'
                            : item.tone === 'danger'
                              ? 'bg-[#FBEAEA] text-[#D96B5F]'
                              : 'bg-slate-100 text-slate-800',
                      )}
                    >
                      {item.type}
                    </span>
                    <div>
                      <p className="font-bold text-[#17212B] font-mono">
                        {item.plate} • <span className="font-sans font-medium text-[#6B6B6B]">{item.title}</span>
                      </p>
                      <p className="text-[12px] text-[#4A4A4A] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#6B6B6B] shrink-0">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: UPI SETTLEMENTS & PAYOUTS
        ========================================================================= */}
        {tab === 'payouts' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-[#075B3D] bg-[#075B3D] text-white p-6 shadow-md space-y-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#E6B84A] block">
                AVAILABLE REVENUE BALANCE
              </span>
              <p className="text-[36px] font-black font-mono text-white leading-none">
                {money(summary?.earningsToday ?? 1463)}
              </p>
              <p className="text-[12px] text-white/80 leading-relaxed">
                Direct instant settlement to registered UPI ID (<span className="font-mono text-[#E6B84A]">sunita@okhdfc</span>).
                Zero fee deductions during Kumbh Mela.
              </p>
              <Button
                full
                size="lg"
                className="bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] font-black uppercase tracking-wide text-[13px] shadow-sm cursor-pointer"
                icon={<Icon name="wallet" size={17} />}
                onClick={() => toast.push({ tone: 'success', title: 'Payout Triggered', message: `₹1,463 initiated to registered UPI.` })}
              >
                Instant UPI Withdrawal
              </Button>
            </div>

            <div className="rounded-3xl border border-[#E8E4DA] bg-white p-6 shadow-2xs space-y-4">
              <h3 className="text-[16px] font-black text-[#17212B] font-heading border-b border-[#E8E4DA] pb-2">
                Monthly Settlement Statement
              </h3>
              <ul className="space-y-2.5 text-[13px]">
                <li className="flex justify-between">
                  <span className="text-[#6B6B6B]">Gross Parking Bookings</span>
                  <span className="font-bold font-mono text-[#17212B]">{money(24100)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#6B6B6B]">Mela Platform Fee (6%)</span>
                  <span className="font-bold font-mono text-[#D96B5F]">− {money(1446)}</span>
                </li>
                <li className="flex justify-between border-t border-[#E8E4DA] pt-2 text-[15px] font-black">
                  <span>Net Disbursed Revenue</span>
                  <span className="font-mono text-[#075B3D]">{money(22654)}</span>
                </li>
              </ul>
              <div className="rounded-xl bg-[#FAF7F2] p-3 text-[11px] text-[#6B6B6B]">
                Weekly automatic payouts cycle every Monday at 09:00 AM IST.
              </div>
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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-black text-[#17212B] font-heading uppercase tracking-wider">
          {title} ({bookings.length})
        </h2>
      </div>

      <div className="space-y-2.5">
        {bookings.map((booking) => {
          const status = BOOKING_STATUS[booking.status]
          const canToggle = booking.status === 'active' || booking.status === 'upcoming'
          const isUpcoming = booking.status === 'upcoming'

          return (
            <div
              key={booking.id}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-2xs transition-all',
                isUpcoming
                  ? 'border-[#E6B84A]/60 ring-1 ring-[#E6B84A]/30'
                  : booking.status === 'active'
                    ? 'border-[#075B3D] ring-1 ring-[#075B3D]/20'
                    : 'border-[#E8E4DA]',
                muted && 'opacity-75',
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl font-mono text-white',
                    isUpcoming ? 'bg-[#D99A2B]' : booking.status === 'active' ? 'bg-[#075B3D]' : 'bg-[#64748B]',
                  )}
                >
                  <Icon name={VEHICLE_ICON[booking.vehicleType]} size={18} />
                </span>

                <div className="min-w-0">
                  <p className="text-[15px] font-black font-mono text-[#17212B]">{booking.plate}</p>
                  <p className="text-[12px] text-[#6B6B6B] truncate">
                    {relativeDay(booking.startISO)} • {time(booking.startISO)} → {time(booking.endISO)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8E4DA]">
                <span className="font-mono font-black text-[14px] text-[#17212B]">
                  {money(booking.amount)}
                </span>

                {canToggle ? (
                  <Button
                    size="sm"
                    variant={isUpcoming ? 'primary' : 'outline'}
                    loading={busyId === booking.id}
                    onClick={() => onToggle(booking)}
                    className={cn(
                      'font-bold text-[12px] px-4',
                      isUpcoming
                        ? 'bg-[#075B3D] hover:bg-[#064e34] text-white shadow-xs'
                        : 'border-[#17212B] hover:bg-[#FAF7F2]',
                    )}
                  >
                    {isUpcoming ? 'Mark Checked-In' : 'Mark Checked-Out'}
                  </Button>
                ) : (
                  <StatusPill tone={status.tone} label={status.label} size="sm" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
