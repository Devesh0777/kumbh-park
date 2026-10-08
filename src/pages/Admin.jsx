import { useMemo, useState } from 'react'
import { decideVerification, getAdminOverview, getIssues, getOccupancy, getVerifications, updateIssue } from '@/api'
import { cn } from '@/lib/cn'
import { dateTime, money, relativeDay, time } from '@/lib/format'
import { ISSUE_STATUS, SEVERITY } from '@/lib/status'
import { useAsync } from '@/hooks/useAsync'
import { PageShell } from '@/components/layout/PageShell'
import KumbhMap from '@/components/map/KumbhMap'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Photo from '@/components/ui/Photo'
import StatusPill from '@/components/ui/StatusPill'
import { Avatar } from '@/components/ui/Bits'
import { Textarea } from '@/components/ui/Field'
import Sheet from '@/components/ui/Sheet'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'

const TABS = [
  { id: 'verifications', label: 'Host Verifications' },
  { id: 'live-ops', label: 'Live Operations & Map' },
  { id: 'analytics', label: 'Network Analytics' },
  { id: 'zones', label: 'Zone Occupancy' },
  { id: 'issues', label: 'Incident Desk' },
]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

// 7-day network revenue trajectory data
const NETWORK_REVENUE_7D = [
  { day: 'Wed', date: 'Oct 01', revenue: 14200, bookings: 42 },
  { day: 'Thu', date: 'Oct 02', revenue: 18600, bookings: 56 },
  { day: 'Fri', date: 'Oct 03', revenue: 26400, bookings: 78 },
  { day: 'Sat', date: 'Oct 04', revenue: 38900, bookings: 114, peak: true },
  { day: 'Sun', date: 'Oct 05', revenue: 34200, bookings: 98 },
  { day: 'Mon', date: 'Oct 06', revenue: 16800, bookings: 48 },
  { day: 'Today', date: 'Oct 07', revenue: 24500, bookings: 72, current: true },
]

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState('verifications')
  const [busyId, setBusyId] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [note, setNote] = useState('')
  const [issueFor, setIssueFor] = useState(null)
  const [revenueRange, setRevenueRange] = useState('7d')
  const [hoveredTrend, setHoveredTrend] = useState(null)

  const { data: overview, loading, error, reload } = useAsync(() => getAdminOverview(), [])
  const { data: subs, reload: reloadSubs } = useAsync(() => getVerifications(), [])
  const { data: issues, reload: reloadIssues } = useAsync(() => getIssues(), [])
  const { data: occupancy } = useAsync(() => getOccupancy(), [])

  const pending = useMemo(() => (subs ?? []).filter((s) => s.status === 'pending'), [subs])
  const openIssues = useMemo(() => (issues ?? []).filter((i) => i.status !== 'resolved'), [issues])

  // Aggregate live capacity metrics
  const capacityStats = useMemo(() => {
    let totalCap = 0
    let totalOpen = 0
    for (const spot of occupancy ?? []) {
      totalCap += spot.capacity || 10
      totalOpen += spot.spotsLeft || 0
    }
    const occupied = Math.max(0, totalCap - totalOpen)
    const rate = totalCap > 0 ? Math.round((occupied / totalCap) * 100) : 78
    return { totalCap: totalCap || 120, totalOpen: totalOpen || 26, occupied: occupied || 94, rate }
  }, [occupancy])

  const decide = async (submission, decision) => {
    setBusyId(submission.id)
    try {
      await decideVerification(submission.id, decision, note || null)
      toast.push({
        tone: decision === 'verified' ? 'success' : 'info',
        title: decision === 'verified' ? 'Listing Approved & Published' : 'Submission Rejected',
        message: `${submission.hostName} • ${submission.title}`,
      })
      setReviewing(null)
      setNote('')
      reloadSubs()
      reload()
    } catch (err) {
      toast.push({ tone: 'error', title: 'Action failed', message: err.friendlyMessage ?? err.message })
    } finally {
      setBusyId(null)
    }
  }

  const setIssueStatus = async (issue, status) => {
    setBusyId(issue.id)
    try {
      await updateIssue(issue.id, { status })
      toast.push({ tone: 'success', title: `Incident marked as ${ISSUE_STATUS[status].label.toLowerCase()}` })
      setIssueFor(null)
      reloadIssues()
      reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageShell>
      {/* ----------------- OPERATIONS CONTROL CENTER HEADER ----------------- */}
      <div className="border-b border-[#E8E4DA] bg-[#F7F4ED] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-[#075B3D] text-[12px] font-black font-mono text-white shadow-xs">
                  KP
                </span>
                <div>
                  <h1 className="text-[20px] sm:text-[22px] font-black tracking-tight text-[#17212B] font-heading">
                    KUMBH PARK OPERATIONS CONTROL CENTER
                  </h1>
                  <p className="text-[11.5px] font-bold text-[#075B3D]">
                    Nashik • Trimbakeshwar • Kumbh 2027
                  </p>
                </div>
              </div>
              <p className="mt-1 text-[12px] text-[#6B6B6B]">
                Real-time pilgrimage mobility command & compound telemetry
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-[#E8E4DA] bg-white text-[#17212B] hover:bg-[#FAF7F2] text-[12px] font-bold shadow-2xs"
                onClick={() => {
                  reload()
                  reloadSubs()
                  reloadIssues()
                  toast.push({ tone: 'info', title: 'Telemetry Synchronized' })
                }}
                icon={<Icon name="refresh" size={14} />}
              >
                Sync Telemetry
              </Button>
            </div>
          </div>

          {/* ----------------- TOP KPI METRIC CARDS (LIGHT SURFACE) ----------------- */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* KPI 1: Pending Verifications */}
            <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B]">
                  PENDING VERIFICATIONS
                </span>
                <span className="size-6 rounded-lg bg-[#FFF8E7] text-[#D99A2B] grid place-items-center">
                  <Icon name="shield" size={13} strokeWidth={2.4} />
                </span>
              </div>
              <p className="mt-1.5 text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                {pending.length}
              </p>
              <span className="mt-2 text-[11px] font-bold text-[#D99A2B] flex items-center gap-1">
                {pending.length > 0 ? '● Requires Review' : '✓ Queue Clear'}
              </span>
            </div>

            {/* KPI 2: Live Bookings */}
            <div className="rounded-2xl border border-[#075B3D]/30 bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                  LIVE BOOKINGS
                </span>
                <span className="size-6 rounded-lg bg-[#E7F1EA] text-[#075B3D] grid place-items-center">
                  <Icon name="car" size={13} strokeWidth={2.4} />
                </span>
              </div>
              <p className="mt-1.5 text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                {overview?.liveBookings ?? 28}
              </p>
              <span className="mt-2 text-[11px] font-bold text-[#075B3D] flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#075B3D] animate-pulse" />
                Active in Compounds
              </span>
            </div>

            {/* KPI 3: Open Issues */}
            <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B]">
                  OPEN INCIDENTS
                </span>
                <span className={cn('size-6 rounded-lg grid place-items-center', openIssues.length > 0 ? 'bg-[#FBEAEA] text-[#D96B5F]' : 'bg-[#E7F1EA] text-[#075B3D]')}>
                  <Icon name="alert" size={13} strokeWidth={2.4} />
                </span>
              </div>
              <p className="mt-1.5 text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                {openIssues.length}
              </p>
              <span className={cn('mt-2 text-[11px] font-bold', openIssues.length > 0 ? 'text-[#D96B5F]' : 'text-[#075B3D]')}>
                {openIssues.length > 0 ? '● Action Required' : '✓ All Resolved'}
              </span>
            </div>

            {/* KPI 4: Gross Booked */}
            <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B]">
                  GROSS BOOKED
                </span>
                <span className="size-6 rounded-lg bg-[#E7F1EA] text-[#075B3D] grid place-items-center">
                  <Icon name="trendUp" size={13} strokeWidth={2.4} />
                </span>
              </div>
              <p className="mt-1.5 text-[24px] sm:text-[28px] font-black font-mono text-[#17212B] leading-none">
                {money(overview?.grossToday ?? 24500)}
              </p>
              <span className="mt-2 text-[11px] font-bold text-[#075B3D]">
                +14% daily velocity
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {/* =========================================================================
            STRUCTURED CLEAN TEXT NAVIGATION TABS (ACTIVE GREEN UNDERLINE + COUNT)
        ========================================================================= */}
        <div className="border-b border-[#E8E4DA]">
          <nav className="flex items-center gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
            {TABS.map((item) => {
              const count = item.id === 'verifications' ? pending.length : item.id === 'issues' ? openIssues.length : 0
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
            ROW 2: BOOKING TREND CHART + LIVE OCCUPANCY RADIAL DONUT
        ========================================================================= */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Booking Trend & Revenue Line/Area Chart */}
          <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8E4DA] pb-3">
              <div>
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                  NETWORK DEMAND TRAJECTORY
                </span>
                <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                  Daily Bookings & Revenue Volume
                </h3>
              </div>

              {/* Range Switcher */}
              <div className="flex items-center rounded-xl bg-[#FAF7F2] p-1 border border-[#E8E4DA]">
                {['7d', '30d', 'mela'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRevenueRange(r)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold uppercase transition-all cursor-pointer',
                      revenueRange === r ? 'bg-[#075B3D] text-white shadow-2xs' : 'text-[#6B6B6B] hover:text-[#17212B]',
                    )}
                  >
                    {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Full Mela'}
                  </button>
                ))}
              </div>
            </div>

            {/* Polished Chart Visualizer */}
            <div className="pt-2">
              <div className="relative flex h-40 items-end justify-between gap-2 sm:gap-3 px-2">
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#E8E4DA]" />
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#E8E4DA]" />

                {NETWORK_REVENUE_7D.map((item) => {
                  const maxAmt = 40000
                  const heightPercent = Math.round((item.revenue / maxAmt) * 100)
                  const isHovered = hoveredTrend?.day === item.day

                  return (
                    <div
                      key={item.day}
                      onMouseEnter={() => setHoveredTrend(item)}
                      onMouseLeave={() => setHoveredTrend(null)}
                      className="group relative flex flex-1 flex-col items-center h-full justify-end cursor-pointer z-10"
                    >
                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <div className="pointer-events-none absolute -top-16 z-30 rounded-xl bg-[#17212B] p-2 text-white shadow-lg whitespace-nowrap animate-[pop-in_0.15s_ease-out]">
                          <p className="text-[10px] font-mono uppercase text-[#E6B84A] font-bold">
                            {item.day} • {item.date}
                          </p>
                          <p className="text-[13px] font-black font-mono mt-0.5">
                            {money(item.revenue)}
                          </p>
                          <p className="text-[10px] text-white/80 font-mono">
                            {item.bookings} vehicle bookings
                          </p>
                        </div>
                      )}

                      {/* Bar with Kumbh Green + Saffron peak */}
                      <div className="w-full relative flex flex-col items-center justify-end h-full">
                        {item.peak && (
                          <span className="absolute -top-5 text-[9px] font-bold text-[#D99A2B] bg-[#FFF8E7] px-1 rounded border border-[#E6B84A]/30">
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

                      <span className={cn('mt-2 text-[11px] font-mono font-bold', item.current ? 'text-[#075B3D]' : 'text-[#6B6B6B]')}>
                        {item.day}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between border-t border-[#E8E4DA] pt-2 text-[11px] text-[#6B6B6B]">
                <span>7-Day Cumulative: <strong className="text-[#17212B] font-mono">₹1,73,600</strong></span>
                <span>Average Daily Velocity: <strong className="text-[#075B3D] font-mono">₹24,800/day</strong></span>
              </div>
            </div>
          </div>

          {/* Live Occupancy Radial Donut Visual */}
          <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-4 flex flex-col justify-between space-y-4">
            <div className="border-b border-[#E8E4DA] pb-2.5">
              <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                NETWORK CAPACITY
              </span>
              <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                Live Occupancy Distribution
              </h3>
            </div>

            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative size-36">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E7F1EA"
                    strokeWidth="3.6"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#075B3D"
                    strokeWidth="3.6"
                    strokeDasharray={`${capacityStats.rate}, 100`}
                    strokeDashoffset="0"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[24px] font-black font-mono text-[#17212B] leading-none">
                    {capacityStats.rate}%
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#075B3D] mt-1">
                    Live Occupancy
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E8E4DA] text-center text-[11px]">
              <div className="rounded-xl bg-[#FAF7F2] p-2">
                <span className="text-[#6B6B6B] block">Total Cap</span>
                <span className="font-mono font-black text-[#17212B] text-[13px]">{capacityStats.totalCap}</span>
              </div>
              <div className="rounded-xl bg-[#E7F1EA] p-2">
                <span className="text-[#075B3D] block">Occupied</span>
                <span className="font-mono font-black text-[#075B3D] text-[13px]">{capacityStats.occupied}</span>
              </div>
              <div className="rounded-xl bg-[#FFF8E7] p-2">
                <span className="text-[#D99A2B] block">Available</span>
                <span className="font-mono font-black text-[#17212B] text-[13px]">{capacityStats.totalOpen}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ROW 3: VERIFICATION PIPELINE STAGES
        ========================================================================= */}
        <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-2.5">
            <div>
              <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                HOST ONBOARDING WORKFLOW
              </span>
              <h3 className="text-[15px] font-black text-[#17212B] font-heading">
                Verification Pipeline
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#6B6B6B]">
              21 Total Applications
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              { stage: '1. SUBMITTED', count: pending.length, color: 'border-amber-300 bg-amber-50 text-amber-900', note: 'Awaiting doc review' },
              { stage: '2. UNDER REVIEW', count: 2, color: 'border-blue-200 bg-blue-50 text-blue-900', note: 'Identity & GPS check' },
              { stage: '3. VERIFIED', count: 18, color: 'border-[#075B3D]/30 bg-[#E7F1EA] text-[#075B3D]', note: 'Police & Mela approved' },
              { stage: '4. LIVE ON MAP', count: 18, color: 'border-[#075B3D] bg-[#075B3D] text-white', note: 'Accepting reservations' },
            ].map((step, idx) => (
              <div key={idx} className={cn('rounded-2xl border p-3.5 space-y-1', step.color)}>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-80">
                  {step.stage}
                </span>
                <p className="text-[22px] font-black font-mono leading-none">{step.count}</p>
                <p className="text-[10.5px] font-medium opacity-90">{step.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================================
            TAB 1: ACTIONABLE VERIFICATION QUEUE
        ========================================================================= */}
        {tab === 'verifications' && (
          <div className="space-y-4">
            {error && <ErrorState message={error.friendlyMessage} onRetry={reload} />}

            {pending.length === 0 && (
              <EmptyState
                icon="shield"
                title="Verification Queue Clear"
                message="All submitted parking plots and host identities have been reviewed."
              />
            )}

            {pending.map((submission) => (
              <article
                key={submission.id}
                className="overflow-hidden rounded-3xl border border-[#E8E4DA] bg-white shadow-2xs transition-all hover:shadow-sm"
              >
                <div className="bg-[#FAF7F2] px-5 py-3 border-b border-[#E8E4DA] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono font-bold text-[#075B3D] text-[12px] uppercase tracking-wider">
                    <span>PERMIT APPLICATION #{submission.id.toUpperCase()}</span>
                    <span>•</span>
                    <span>SECTOR {submission.zoneName}</span>
                  </div>
                  <StatusPill tone="warning" label={`Submitted ${relativeDay(submission.submittedISO)}`} size="sm" pulse />
                </div>

                <div className="p-5 flex flex-col lg:flex-row gap-5 items-start justify-between">
                  <div className="flex gap-4 items-start min-w-0 flex-1">
                    <Photo
                      seed={submission.id}
                      label={submission.zoneName}
                      ratio="aspect-square w-24 shrink-0"
                      rounded="rounded-2xl"
                    />

                    <div className="min-w-0 space-y-1">
                      <h3 className="text-[17px] font-black text-[#17212B] font-heading truncate">
                        {submission.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#17212B]">
                        <Avatar size={22} tone="sage" />
                        <span>Host: {submission.hostName}</span>
                        <span>•</span>
                        <span className="font-mono text-[#6B6B6B]">{submission.phone}</span>
                      </div>
                      <p className="text-[12px] text-[#6B6B6B]">{submission.address}</p>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="rounded-lg bg-[#FAF7F2] border border-[#E8E4DA] px-2.5 py-1 text-[11px] font-mono font-bold text-[#17212B]">
                          {submission.capacity} Vehicle Capacity
                        </span>
                        <span className="rounded-lg bg-[#FAF7F2] border border-[#E8E4DA] px-2.5 py-1 text-[11px] font-mono font-bold text-[#075B3D]">
                          {money(submission.priceHour)}/hr Base Rate
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attached Verification Documents */}
                  <div className="w-full lg:w-72 space-y-2 border-t lg:border-t-0 lg:border-l border-[#E8E4DA] pt-3 lg:pt-0 lg:pl-5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B] block">
                      Submitted Documents
                    </span>
                    <div className="space-y-1.5">
                      {submission.documents.map((doc) => (
                        <div
                          key={doc}
                          className="flex items-center gap-2 rounded-xl bg-[#FAF7F2] border border-[#E8E4DA] px-3 py-1.5 text-[11px] font-bold text-[#17212B]"
                        >
                          <Icon name="check" size={13} className="text-[#075B3D]" />
                          <span className="truncate">{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {submission.note && (
                  <div className="mx-5 mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900">
                    <span className="font-bold">Host Operational Note:</span> “{submission.note}”
                  </div>
                )}

                {/* Direct Action Bar with Green Approve & Coral Reject */}
                <div className="bg-[#FAF7F2]/80 px-5 py-3 border-t border-[#E8E4DA] flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold bg-white text-[12px] border-[#E8E4DA] text-[#17212B] hover:bg-[#FAF7F2]"
                    onClick={() => {
                      setReviewing(submission)
                      setNote('')
                    }}
                  >
                    Inspect Full Dossier
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="font-bold text-[#D96B5F] hover:bg-[#FBEAEA] text-[12px]"
                      icon={<Icon name="x" size={14} />}
                      onClick={() => decide(submission, 'rejected')}
                    >
                      Reject Submission
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#075B3D] hover:bg-[#064e34] text-white font-bold text-[12px] shadow-2xs px-5"
                      loading={busyId === submission.id}
                      icon={<Icon name="check" size={14} strokeWidth={2.6} />}
                      onClick={() => decide(submission, 'verified')}
                    >
                      Approve & Publish Listing
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* =========================================================================
            TAB 2: LIVE OPERATIONS & GATE TRAFFIC STREAM
        ========================================================================= */}
        {tab === 'live-ops' && (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Live Map Stream */}
              <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-3">
                  <div>
                    <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                      SECTOR TELEMETRY MAP
                    </span>
                    <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                      Live Compound Inventory Distribution
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#075B3D] animate-pulse" />
                    <span className="text-[12px] font-mono font-bold text-[#17212B]">18 Active Plots</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E8E4DA]">
                  <div className="relative h-80">
                    <KumbhMap spots={occupancy ?? []} zoom={13} showZoom />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] font-semibold text-[#6B6B6B] pt-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#075B3D]" /> Open / Free Bays</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#E6B84A]" /> Filling Fast (&gt;75%)</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#D96B5F]" /> 100% Full</span>
                  </div>
                  <span>{capacityStats.totalOpen} of {capacityStats.totalCap} bays currently free</span>
                </div>
              </div>

              {/* Real-Time Gate Traffic Log */}
              <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-4 space-y-3">
                <div className="border-b border-[#E8E4DA] pb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-black text-[#17212B] font-heading">
                    Gate Checkpoint Stream
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-[#075B3D] uppercase bg-[#E7F1EA] px-2 py-0.5 rounded">
                    Real-time
                  </span>
                </div>

                <div className="space-y-2.5 pt-1 max-h-[340px] overflow-y-auto no-scrollbar">
                  {[
                    { plate: 'MH 15 AB 1234', spot: 'Ramkund North Gate', status: 'CHECKED IN', time: '10m ago', tone: 'success' },
                    { plate: 'MH 04 ER 8890', spot: 'Panchavati Courtyard', status: 'CHECKED IN', time: '24m ago', tone: 'success' },
                    { plate: 'MH 12 QK 5541', spot: 'Tapovan Ashram Bay', status: 'CHECKED OUT', time: '38m ago', tone: 'neutral' },
                    { plate: 'MH 14 JK 9021', spot: 'Trimbakeshwar Portico', status: 'BOOKED', time: '45m ago', tone: 'warning' },
                    { plate: 'MH 20 CD 3312', spot: 'Godavari Plot B', status: 'CHECKED OUT', time: '1h ago', tone: 'neutral' },
                  ].map((log, i) => (
                    <div key={i} className="rounded-xl bg-[#FAF7F2] p-3 text-[12px] space-y-1 border border-[#E8E4DA]/70">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-[#17212B]">{log.plate}</span>
                        <span className="font-mono text-[10px] font-bold text-[#6B6B6B]">{log.time}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#6B6B6B] truncate max-w-[140px]">{log.spot}</span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase', log.tone === 'success' ? 'bg-[#E7F1EA] text-[#075B3D]' : log.tone === 'warning' ? 'bg-[#FFF8E7] text-[#B47C10]' : 'bg-slate-200 text-slate-700')}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: REVENUE & DEMAND ANALYTICS
        ========================================================================= */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-8 space-y-4">
                <div className="border-b border-[#E8E4DA] pb-3">
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                    SECTOR MOBILITY DISTRIBUTION
                  </span>
                  <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                    Zone Volume & Pricing Health
                  </h3>
                </div>

                <div className="space-y-3">
                  {(overview?.zoneLoad ?? []).map((zone) => (
                    <div key={zone.id} className="rounded-2xl bg-[#FAF7F2] border border-[#E8E4DA] p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-bold text-[#17212B]">{zone.name} Sector</span>
                        <span className="font-mono font-bold text-[12px] text-[#075B3D]">
                          {zone.rate}% Load • {zone.open} plots free
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E8E4DA]">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', zone.rate > 75 ? 'bg-[#075B3D]' : 'bg-[#0B7651]')}
                          style={{ width: `${zone.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Snan Demand Windows */}
              <div className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs lg:col-span-4 space-y-4">
                <div className="border-b border-[#E8E4DA] pb-3">
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#075B3D]">
                    DEMAND INTELLIGENCE
                  </span>
                  <h3 className="text-[16px] font-black text-[#17212B] font-heading">
                    Peak Holy Snan Demand
                  </h3>
                </div>

                <div className="space-y-3 text-[13px]">
                  <div className="rounded-2xl bg-[#E7F1EA] border border-[#075B3D]/20 p-3.5 space-y-1">
                    <span className="text-[11px] font-mono font-bold uppercase text-[#075B3D] block">
                      Morning Snan Window (04:00 – 09:00)
                    </span>
                    <p className="font-bold text-[#17212B] text-[15px]">94% Maximum Load</p>
                    <p className="text-[11px] text-[#6B6B6B]">Highest demand near Ramkund & Panchavati Kunds.</p>
                  </div>

                  <div className="rounded-2xl bg-[#FFF8E7] border border-[#E6B84A]/30 p-3.5 space-y-1">
                    <span className="text-[11px] font-mono font-bold uppercase text-[#B47C10] block">
                      Evening Aarti Window (17:30 – 20:30)
                    </span>
                    <p className="font-bold text-[#17212B] text-[15px]">88% Maximum Load</p>
                    <p className="text-[11px] text-[#6B6B6B]">Heavy influx across Godavari Left Bank corridors.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: LOCATION & ZONE OCCUPANCY
        ========================================================================= */}
        {tab === 'zones' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#075B3D]/30 bg-[#E7F1EA] p-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#075B3D] block">
                  HIGHEST OCCUPANCY SECTOR
                </span>
                <p className="mt-1 text-[18px] font-black text-[#17212B] font-heading">Ramkund Ghats</p>
                <span className="mt-1 text-[12px] font-bold text-[#075B3D] block font-mono">92% Occupied • 2 Bays Free</span>
              </div>

              <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#075B3D] block">
                  AVAILABLE OVERFLOW SECTOR
                </span>
                <p className="mt-1 text-[18px] font-black text-[#17212B] font-heading">Nashik Road Stn</p>
                <span className="mt-1 text-[12px] font-bold text-[#075B3D] block font-mono">48% Occupied • 14 Bays Free</span>
              </div>

              <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B] block">
                  TOTAL NETWORK BAYS
                </span>
                <p className="mt-1 text-[22px] font-black font-mono text-[#17212B]">{capacityStats.totalCap}</p>
                <span className="text-[11px] text-[#6B6B6B]">18 Verified Plots</span>
              </div>

              <div className="rounded-2xl border border-[#E8E4DA] bg-white p-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6B6B6B] block">
                  CURRENTLY VACANT
                </span>
                <p className="mt-1 text-[22px] font-black font-mono text-[#075B3D]">{capacityStats.totalOpen}</p>
                <span className="text-[11px] text-[#6B6B6B]">Immediate entry available</span>
              </div>
            </div>

            {/* Zone List Progress Breakdown */}
            <div className="space-y-3 pt-2">
              {(overview?.zoneLoad ?? []).map((zone) => (
                <div key={zone.id} className="rounded-2xl bg-white border border-[#E8E4DA] p-4 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="font-bold text-[#17212B] font-heading">{zone.name}</span>
                    <span className="font-mono font-bold text-[13px] text-[#17212B]">
                      {zone.open} of {zone.listings} plots free ({zone.rate}% capacity)
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#E8E4DA]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        zone.rate > 65 ? 'bg-[#075B3D]' : zone.rate > 35 ? 'bg-[#D99A2B]' : 'bg-[#64748B]',
                      )}
                      style={{ width: `${zone.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: INCIDENT & ISSUE DESK (SEVERITY COLORS)
        ========================================================================= */}
        {tab === 'issues' && (
          <div className="space-y-3">
            {openIssues.length === 0 && (
              <EmptyState icon="checkCircle" title="Zero Open Incidents" message="All pilgrim access alerts and compound inquiries are resolved." />
            )}

            {(issues ?? []).map((issue) => {
              const status = ISSUE_STATUS[issue.status]
              const severityTone = issue.severity === 'high' ? 'bg-[#FBEAEA] text-[#D96B5F] border-[#D96B5F]/30' : issue.severity === 'medium' ? 'bg-[#FFF8E7] text-[#B47C10] border-[#E6B84A]/30' : 'bg-slate-100 text-slate-700 border-slate-200'

              return (
                <article key={issue.id} className="rounded-3xl border border-[#E8E4DA] bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#6B6B6B] uppercase">
                          INCIDENT #{issue.id.toUpperCase()}
                        </span>
                        <span>•</span>
                        <span className="text-[12px] font-bold text-[#075B3D]">{issue.zoneName}</span>
                      </div>
                      <h4 className="mt-1 text-[16px] font-black text-[#17212B] font-heading">{issue.title}</h4>
                      <p className="text-[12px] text-[#6B6B6B]">Type: {issue.type} • Raised by {issue.raisedBy}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill tone={status.tone} label={status.label} size="sm" />
                      <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase border', severityTone)}>
                        {issue.severity} priority
                      </span>
                    </div>
                  </div>

                  <p className="rounded-2xl bg-[#FAF7F2] p-3.5 text-[13px] leading-relaxed text-[#4A4A4A]">
                    {issue.detail}
                  </p>

                  <div className="flex items-center justify-between border-t border-[#E8E4DA] pt-3 text-[12px]">
                    <span className="text-[#6B6B6B] font-mono">{dateTime(issue.raisedISO)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-bold text-[12px] border-[#E8E4DA] bg-white"
                      onClick={() => setIssueFor(issue)}
                    >
                      Update Status / Resolve
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          VERIFICATION REVIEW DOSSIER MODAL
      ========================================================================= */}
      <Sheet
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Dossier Review"
        subtitle={reviewing?.title}
        height="auto"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              full
              size="lg"
              className="text-[#D96B5F] border-[#D96B5F]/40 hover:bg-[#FBEAEA] font-bold"
              onClick={() => decide(reviewing, 'rejected')}
              loading={busyId === reviewing?.id}
            >
              Reject
            </Button>
            <Button
              full
              size="lg"
              className="bg-[#075B3D] hover:bg-[#064e34] text-white font-bold"
              onClick={() => decide(reviewing, 'verified')}
              loading={busyId === reviewing?.id}
              icon={<Icon name="check" size={16} strokeWidth={2.6} />}
            >
              Approve Listing
            </Button>
          </div>
        }
      >
        {reviewing && (
          <div className="space-y-4 pt-1">
            <div className="flex gap-4 items-start">
              <Photo seed={reviewing.id} label={reviewing.zoneName} ratio="aspect-square w-20 shrink-0" rounded="rounded-xl" />
              <div className="min-w-0 text-[13px] space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-[#17212B]">
                  <Avatar size={20} tone="sage" />
                  <span>{reviewing.hostName}</span>
                </div>
                <p className="text-[#6B6B6B] font-mono">{reviewing.phone}</p>
                <p className="text-[#6B6B6B]">{reviewing.address}</p>
                <p className="text-[11px] font-mono text-[#075B3D]">
                  GPS: {reviewing.latlng[0].toFixed(4)}, {reviewing.latlng[1].toFixed(4)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {reviewing.vehicles.map((vehicle) => (
                <span
                  key={vehicle}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FAF7F2] border border-[#E8E4DA] px-3 py-1 text-[12px] font-bold text-[#17212B]"
                >
                  <Icon name={VEHICLE_ICON[vehicle]} size={14} className="text-[#075B3D]" />
                  <span className="capitalize">{vehicle} Class</span>
                </span>
              ))}
            </div>

            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Official notification note for host (optional)"
              className="bg-white"
            />
          </div>
        )}
      </Sheet>

      {/* =========================================================================
          ISSUE STATUS UPDATE MODAL
      ========================================================================= */}
      <Sheet
        open={Boolean(issueFor)}
        onClose={() => setIssueFor(null)}
        title="Update Incident Status"
        subtitle={issueFor?.title}
        height="auto"
      >
        {issueFor && (
          <div className="space-y-2 pt-1">
            {Object.entries(ISSUE_STATUS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIssueStatus(issueFor, key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer active:scale-99',
                  issueFor.status === key ? 'border-[#075B3D] bg-[#E7F1EA] ring-2 ring-[#075B3D]/20' : 'border-[#E8E4DA] bg-white hover:bg-[#FAF7F2]',
                )}
              >
                <span className="text-[14px] font-bold text-[#17212B]">{value.label}</span>
                {issueFor.status === key && <Icon name="checkCircle" size={18} className="text-[#075B3D]" />}
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </PageShell>
  )
}
