import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from '@/components/ui/QRCode'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { qrPayload } from '@/lib/id'
import { money, time, durationLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import ParkingDemoModal from '@/components/demo/ParkingDemoModal'

/**
 * Format date in authentic heritage ticket format: "08 JUN 2027"
 */
function formatTicketDate(isoString) {
  if (!isoString) return '08 JUN 2027'
  try {
    const d = new Date(isoString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  } catch {
    return '08 JUN 2027'
  }
}

/**
 * Real Perforation Seam Component
 * Renders SVG dotted perforation dots, top/bottom scalloped cutouts,
 * glowing laser cut path, traveling scissors icon ✂, and sparks.
 */
function PerforationSeam({ animState, cutProgress }) {
  const isVerifying = animState === 'exit-verifying'
  const isCutting = animState === 'cutting'
  const isSeparated = animState === 'separated' || animState === 'completed'

  return (
    <div className="relative flex md:flex-col items-center justify-center shrink-0 z-30 w-full md:w-6 h-6 md:h-auto my-1 md:my-0 select-none">
      {/* Top Round Cutout Notch (Desktop) */}
      <div className="hidden md:block absolute -top-3.5 left-1/2 -translate-x-1/2 size-7 rounded-full bg-[#EFE9DC] border border-[#D5C9B3] shadow-inner z-30" />
      {/* Left Round Cutout Notch (Mobile) */}
      <div className="md:hidden absolute -left-3.5 top-1/2 -translate-y-1/2 size-7 rounded-full bg-[#EFE9DC] border border-[#D5C9B3] shadow-inner z-30" />

      {/* Seam Container */}
      <div className="relative w-full md:w-auto h-full flex md:flex-col items-center justify-center py-2 md:py-6 px-4 md:px-0">
        <svg
          className="w-full md:w-2 h-2 md:h-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Base Dotted Perforation Seam */}
          <line
            x1="50%"
            y1="0%"
            x2="50%"
            y2="100%"
            stroke={isVerifying ? '#E9A83A' : '#C5B59C'}
            strokeWidth="3"
            strokeDasharray="4 7"
            strokeLinecap="round"
            className={cn(
              'transition-colors duration-200',
              isVerifying && 'animate-pulse stroke-[#E9A83A]'
            )}
          />

          {/* Glowing Digital Cut Path Line */}
          {(isCutting || isSeparated) && (
            <line
              x1="50%"
              y1="0%"
              x2="50%"
              y2={`${isCutting ? cutProgress : 100}%`}
              stroke="#E9A83A"
              strokeWidth="4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_#E9A83A]"
            />
          )}
        </svg>

        {/* Highlight Seam Pulse Ring during 'exit-verifying' */}
        {isVerifying && (
          <div className="absolute inset-0 bg-[#E9A83A]/20 blur-sm animate-pulse rounded-full" />
        )}

        {/* Traveling Scissors Icon ✂ and Sparks (Step 2) */}
        {isCutting && (
          <div
            className="hidden md:block absolute left-1/2 -translate-x-1/2 z-40 transition-all duration-75 pointer-events-none"
            style={{ top: `${cutProgress}%` }}
          >
            {/* Spark Glow halo */}
            <div className="absolute -inset-2.5 animate-ping rounded-full bg-[#E9A83A]/40" />
            <div className="relative grid size-7 place-items-center rounded-full bg-[#17212B] text-[#FFD166] text-[13px] shadow-[0_0_14px_#E9A83A] border-2 border-[#E9A83A]">
              ✂
            </div>
            {/* Laser cut sparks */}
            <div className="absolute -top-2 -right-3 text-[10px] text-[#FFD166] animate-bounce">✨</div>
            <div className="absolute -bottom-2 -left-3 text-[10px] text-[#E9A83A] animate-pulse">⚡</div>
          </div>
        )}
      </div>

      {/* Bottom Round Cutout Notch (Desktop) */}
      <div className="hidden md:block absolute -bottom-3.5 left-1/2 -translate-x-1/2 size-7 rounded-full bg-[#EFE9DC] border border-[#D5C9B3] shadow-inner z-30" />
      {/* Right Round Cutout Notch (Mobile) */}
      <div className="md:hidden absolute -right-3.5 top-1/2 -translate-y-1/2 size-7 rounded-full bg-[#EFE9DC] border border-[#D5C9B3] shadow-inner z-30" />
    </div>
  )
}

/**
 * Premium 2-Piece Digital Parking Ticket Component
 * Structurally divided into:
 * 1. `.ticket-main` (Left section)
 * 2. `.ticket-qr` (Right section)
 * Separated by a real SVG Perforation Seam.
 *
 * Exit Cut Animation States:
 * idle -> exit-verifying (~250ms) -> cutting (~500ms) -> separated (~350ms) -> completed (~400ms)
 */
export default function DigitalParkingTicket({
  booking,
  spot,
  onClose,
  showActions = true,
  ticketState = 'CONFIRMED', // 'CONFIRMED' | 'ENTRY_VERIFIED' | 'PARKING_ACTIVE' | 'EXIT_VERIFIED' | 'COMPLETED'
  isAnimatingCut = false,
  entryTime = '10:42 PM',
  exitTime = '11:58 PM',
  className = '',
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const ticketRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)

  // Exit Cut State Machine: 'idle' | 'exit-verifying' | 'cutting' | 'separated' | 'completed'
  const [animState, setAnimState] = useState(() => {
    if (ticketState === 'COMPLETED') return 'completed'
    if (ticketState === 'EXIT_VERIFIED' || isAnimatingCut) return 'exit-verifying'
    return 'idle'
  })
  const [cutProgress, setCutProgress] = useState(0)

  // Trigger step-by-step Exit Cut animation sequence
  const runExitCutSequence = () => {
    setAnimState('exit-verifying')
    setCutProgress(0)

    // Step 1: VERIFY (~250ms)
    setTimeout(() => {
      setAnimState('cutting')
      setCutProgress(0)

      // Step 2: CUT PATH (~500ms top -> bottom)
      const interval = setInterval(() => {
        setCutProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            // Step 3: SEPARATE THE QR SECTION (~350ms shift 16px right)
            setAnimState('separated')

            // Step 4: SETTLE (~400ms)
            setTimeout(() => {
              setAnimState('completed')
            }, 750)

            return 100
          }
          return prev + 20
        })
      }, 70)
    }, 250)
  }

  // React to prop changes
  useEffect(() => {
    if (isAnimatingCut || ticketState === 'EXIT_VERIFIED') {
      runExitCutSequence()
    } else if (ticketState === 'COMPLETED') {
      setAnimState('completed')
      setCutProgress(100)
    } else {
      setAnimState('idle')
      setCutProgress(0)
    }
  }, [isAnimatingCut, ticketState])

  if (!booking && !spot) return null

  // Resolve dynamic values from booking and/or spot
  const spotTitle = booking?.title || spot?.title || 'Driveway Behind Sagar Petrol Pump'
  const spotAddress =
    booking?.address || spot?.address || 'Sagar Colony, off Agra Road, Nashik'
  const distance = spot?.distanceM ?? booking?.distanceM ?? 230
  const hours = booking?.hours ?? 2
  const startISO = booking?.startISO || booking?.start || new Date().toISOString()
  const endISO =
    booking?.endISO ||
    booking?.end ||
    new Date(Date.now() + (hours || 2) * 3600_000).toISOString()
  const amount = booking?.amount ?? spot?.priceHour * hours ?? 87
  const hourlyRate = spot?.priceHour ?? Math.round(amount / (hours || 1))
  const plate = booking?.plate || 'MH 15 AB 1234'
  const passCode = booking?.code || 'NPC-CFLCH'
  const pin = booking?.pin || '4829'
  const dateFormatted = formatTicketDate(startISO)
  const startTimeFormatted = time(startISO)
  const endTimeFormatted = time(endISO)

  // Construct payload for QR
  const qrData = qrPayload(booking || {
    id: 'b_demo',
    code: passCode,
    spotId: spot?.id || 's1',
    plate,
    startISO,
    endISO,
    pin,
  })

  // Download Handler
  const handleDownload = async () => {
    setDownloading(true)
    try {
      window.print()
      toast.push({
        tone: 'success',
        title: 'Ticket Ready',
        message: 'Pass sent to printer / PDF download dialog.',
      })
    } catch {
      toast.push({
        tone: 'info',
        title: 'Pass Ready',
        message: 'Take a screenshot or print this pass for gate scan.',
      })
    } finally {
      setDownloading(false)
    }
  }

  // Share Handler
  const handleShare = async () => {
    const shareText = `🎫 KUMBH PARK DIGITAL PASS\nPass ID: ${passCode}\nSpot: ${spotTitle}\nVehicle: ${plate}\nTime: ${startTimeFormatted} (${dateFormatted})\nGate PIN: ${pin}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kumbh Park Digital Parking Pass',
          text: shareText,
          url: window.location.origin + '/bookings',
        })
        toast.push({ tone: 'success', title: 'Shared successfully' })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(shareText)
      toast.push({
        tone: 'success',
        title: 'Pass details copied',
        message: 'Share this booking summary with co-pilgrims.',
      })
    } catch {
      toast.push({ tone: 'info', title: 'Pass ID', message: `${passCode} • PIN: ${pin}` })
    }
  }

  const isEntryDone =
    ticketState === 'ENTRY_VERIFIED' ||
    ticketState === 'PARKING_ACTIVE' ||
    ticketState === 'EXIT_VERIFIED' ||
    ticketState === 'COMPLETED' ||
    animState !== 'idle'

  const isSeparated = animState === 'separated' || animState === 'completed'

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* ---------------------------------------------------------------------
          DYNAMIC STATUS BANNER HEADER
      --------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex size-2.5 rounded-full animate-pulse',
              isSeparated
                ? 'bg-slate-500'
                : animState === 'cutting' || animState === 'exit-verifying'
                  ? 'bg-amber-500'
                  : isEntryDone
                    ? 'bg-emerald-500'
                    : 'bg-[#E9A83A]',
            )}
          />
          <span className="text-[12px] font-mono font-black uppercase tracking-widest text-[#006B4F]">
            {animState === 'exit-verifying'
              ? '✓ Exit Verified • Highlighting Perforation Seam'
              : animState === 'cutting'
                ? '✂ Digital Laser Cutting In Progress...'
                : isSeparated
                  ? '✓ Completed Kumbh Parking Permit'
                  : isEntryDone
                    ? 'Active Gate Clearance • Entry Verified'
                    : 'Official Kumbh Mela 2027 E-Permit'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Interactive Trigger Button for Exit Cut Animation */}
          <button
            type="button"
            onClick={runExitCutSequence}
            className="rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-[#8B5A2B] border border-amber-500/40 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <span>✂</span>
            <span>Test Exit Cut</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDemoModal(true)}
            className="rounded-full bg-[#006B4F]/10 hover:bg-[#006B4F]/20 text-[#006B4F] border border-[#006B4F]/30 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
          >
            <span>▶</span>
            <span>Run Full Demo</span>
          </button>

          <span
            className={cn(
              'rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-xs transition-colors',
              isSeparated
                ? 'bg-slate-800'
                : animState === 'cutting'
                  ? 'bg-amber-600'
                  : isEntryDone
                    ? 'bg-emerald-600'
                    : 'bg-[#006B4F]',
            )}
          >
            {isSeparated
              ? '✓ Completed'
              : animState === 'cutting'
                ? '✂ Cutting'
                : isEntryDone
                  ? '✓ Entry Verified'
                  : '✓ Confirmed'}
          </span>
        </div>
      </div>

      {/* =========================================================================
          THE PHYSICAL 2-PIECE TICKET PASS CONTAINER (Max width 840px desktop)
      ========================================================================= */}
      <div
        ref={ticketRef}
        className="print:shadow-none relative mx-auto w-full max-w-[840px] select-none"
      >
        {/* =====================================================================
            STRUCTURAL 2-SECTION FLEX LAYOUT:
            .ticket-main  +  <PerforationSeam />  +  .ticket-qr
        ===================================================================== */}
        <div className="flex flex-col md:flex-row items-stretch relative">
          {/* ===================================================================
              1. LEFT / MAIN PARKING TICKET CONTAINER (.ticket-main)
          =================================================================== */}
          <div
            className={cn(
              'ticket-main relative flex-1 p-5 sm:p-7 pb-6 flex flex-col justify-between overflow-hidden min-h-[300px]',
              'rounded-t-[24px] md:rounded-l-[28px] md:rounded-tr-none border border-[#D5C9B3] bg-[#FAF6EE] shadow-[0_12px_36px_-8px_rgba(23,33,43,0.15)]',
              'z-10 transition-all duration-300'
            )}
            style={{
              backgroundImage: `
                radial-gradient(ellipse at top left, rgba(233,168,58,0.12) 0%, transparent 55%),
                radial-gradient(ellipse at bottom right, rgba(139,46,33,0.08) 0%, transparent 60%),
                linear-gradient(180deg, #FAF7F0 0%, #F4ECE0 100%)
              `,
            }}
          >
            {/* ENTRY PUNCH HOLE VALIDATION MARK (Appears when Entry Verified) */}
            {isEntryDone && (
              <div className="absolute top-3 right-3 z-40 flex items-center gap-1.5 animate-fadeIn">
                <div className="size-7 rounded-full bg-[#17212B] border-2 border-[#E9A83A] shadow-inner grid place-items-center">
                  <span className="text-[10px] font-black text-[#E9A83A]">✓</span>
                </div>
                <span className="text-[9.5px] font-mono font-black text-[#006B4F] bg-white/95 px-2 py-0.5 rounded border border-[#006B4F]/30 uppercase shadow-xs">
                  PUNCHED {entryTime}
                </span>
              </div>
            )}

            {/* Scalloped Left Edge Notches */}
            <div className="absolute left-0 top-0 bottom-0 z-20 flex flex-col justify-around py-4 pointer-events-none">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={`left-notch-${i}`}
                  className="size-3.5 -ml-2 rounded-full bg-[#EFE9DC] border-r border-[#D5C9B3] shadow-inner"
                />
              ))}
            </div>

            {/* Background Heritage Ghat Artwork */}
            <div className="absolute left-0 bottom-0 w-[220px] sm:w-[260px] md:w-[285px] h-[220px] sm:h-[260px] pointer-events-none select-none z-0 overflow-hidden">
              <img
                src="/images/temple-heritage-faded.png"
                alt="Nashik Godavari Ghat Temples"
                className="w-full h-full object-contain object-left-bottom mix-blend-multiply opacity-95"
              />
            </div>

            {/* Distant Boat & River Horizon Artwork */}
            <div className="hidden sm:block absolute right-2 bottom-0 w-[150px] md:w-[180px] h-[85px] pointer-events-none select-none z-0 overflow-hidden">
              <img
                src="/images/distant-boat.png"
                alt="Godavari River Pilgrimage Boat"
                className="w-full h-full object-contain object-right-bottom mix-blend-multiply opacity-75"
              />
            </div>

            {/* Content Header */}
            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between text-[10.5px] sm:text-[12px] font-bold tracking-[0.22em] text-[#8B2E21] uppercase border-b border-[#E2D8C5] pb-2 font-serif">
                <span className="whitespace-nowrap flex items-center gap-1.5 shrink-0">
                  <span className="size-1.5 rounded-full bg-[#E9A83A]" />
                  MAHA KUMBH MELA 2027
                </span>
                <span className="text-[#66706B] font-sans font-medium text-[9.5px] sm:text-[11px] whitespace-nowrap tracking-wider">
                  NASHIK • TRIMBAKESHWAR
                </span>
              </div>

              <div className="pt-1">
                <h2 className="text-[20px] sm:text-[24px] md:text-[27px] font-black tracking-tight text-[#17212B] uppercase font-serif leading-[1.18] drop-shadow-xs max-w-[540px]">
                  {spotTitle}
                </h2>
                <p className="mt-1 text-[11px] sm:text-[12.5px] font-semibold text-[#66706B] uppercase tracking-wider font-sans truncate max-w-[500px]">
                  {spotAddress}
                </p>
              </div>
            </div>

            {/* 4 Info Metric Pills */}
            <div className="relative z-10 mt-6 pt-3.5 border-t border-[#DED4BF] grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-[#FAF7F0]/85 backdrop-blur-[2px] rounded-2xl p-2.5 sm:p-3 border border-[#E8DFC9]/70">
              {/* DISTANCE */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-full bg-[#8B2E21] text-white shadow-xs">
                  <Icon name="pin" size={15} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#8A7E72] truncate">
                    DISTANCE
                  </span>
                  <span className="block text-[13px] sm:text-[14px] font-black text-[#17212B] font-mono leading-tight">
                    {distance} m
                  </span>
                  <span className="block text-[9px] font-medium text-[#66706B] truncate">from Ghat</span>
                </div>
              </div>

              {/* DURATION */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-full bg-[#E9A83A] text-[#17212B] shadow-xs">
                  <Icon name="clock" size={15} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#8A7E72] truncate">
                    DURATION
                  </span>
                  <span className="block text-[13px] sm:text-[14px] font-black text-[#17212B] font-mono leading-tight truncate">
                    {durationLabel(hours)}
                  </span>
                  <span className="block text-[9px] font-medium text-[#66706B] truncate">
                    {startTimeFormatted} - {endTimeFormatted}
                  </span>
                </div>
              </div>

              {/* AMOUNT */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-full bg-[#006B4F] text-white shadow-xs font-bold text-[13px]">
                  ₹
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#8A7E72] truncate">
                    AMOUNT
                  </span>
                  <span className="block text-[14px] sm:text-[15px] font-black text-[#006B4F] font-mono leading-tight">
                    {money(amount)}
                  </span>
                  <span className="block text-[9px] font-medium text-[#66706B] truncate">
                    (₹{hourlyRate}/hr)
                  </span>
                </div>
              </div>

              {/* VEHICLE NO. */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-full bg-[#17212B] text-white shadow-xs">
                  <Icon name="car" size={15} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#8A7E72] truncate">
                    VEHICLE NO.
                  </span>
                  <span className="block text-[12px] sm:text-[13px] font-black text-[#17212B] uppercase font-mono tracking-wide leading-tight truncate">
                    {plate}
                  </span>
                  <span className="block text-[9px] font-bold text-[#006B4F] truncate">BAY CONFIRMED</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===================================================================
              2. REAL SVG PERFORATION SEAM COMPONENT
          =================================================================== */}
          <PerforationSeam animState={animState} cutProgress={cutProgress} />

          {/* ===================================================================
              3. RIGHT / QR ENTRY PASS SECTION CONTAINER (.ticket-qr)
              Can independently transform / translate 16px to the RIGHT
          =================================================================== */}
          <div
            className={cn(
              'ticket-qr relative md:w-[250px] p-5 sm:p-6 text-center text-white flex flex-col justify-between items-center overflow-hidden shrink-0',
              'rounded-b-[24px] md:rounded-r-[28px] md:rounded-bl-none border border-[#9A3525]',
              'z-20 transition-all duration-300 ease-out',
              isSeparated
                ? 'translate-y-4 md:translate-y-0 md:translate-x-5 shadow-[-14px_0_32px_rgba(0,0,0,0.32)] ring-1 ring-amber-500/20'
                : 'translate-x-0 translate-y-0 shadow-[0_12px_36px_-8px_rgba(23,33,43,0.15)]'
            )}
            style={{
              backgroundColor: '#7A2418',
              backgroundImage: `
                radial-gradient(circle at top right, rgba(233,168,58,0.3) 0%, transparent 60%),
                linear-gradient(165deg, #8B2E21 0%, #641D14 100%)
              `,
            }}
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
                backgroundSize: '10px 10px',
              }}
            />

            {/* Scalloped Right Edge Notches */}
            <div className="absolute right-0 top-0 bottom-0 z-20 flex flex-col justify-around py-4 pointer-events-none">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={`right-notch-${i}`}
                  className="size-3.5 -mr-2 rounded-full bg-[#EFE9DC] border-l border-[#D5C9B3] shadow-inner"
                />
              ))}
            </div>

            {/* Stub Header */}
            <div className="relative z-10 w-full space-y-0.5">
              <h3 className="text-[15px] sm:text-[16px] font-black tracking-[0.22em] text-[#F7F3EA] uppercase font-serif whitespace-nowrap">
                ENTRY PASS
              </h3>
              <p className="text-[9px] font-bold tracking-[0.18em] text-[#E9A83A] uppercase font-sans whitespace-nowrap">
                KUMBH MELA 2027 • NASHIK
              </p>
            </div>

            {/* Large High-Contrast QR Code Card */}
            <div className="relative z-10 my-3 p-2 bg-white rounded-xl shadow-md border-2 border-[#FAF6EE]/30">
              <QRCode value={qrData} size={135} className="p-0 border-0 shadow-none rounded-lg" />
            </div>

            {/* Instruction & Pass ID */}
            <div className="relative z-10 w-full space-y-2">
              <p className="text-[9.5px] font-black tracking-[0.2em] text-[#F7F3EA]/90 uppercase font-mono">
                {isSeparated ? 'PERMIT CLOSED • DETACHED' : 'SCAN AT GATE'}
              </p>

              <div className="border-t border-b border-white/20 py-1.5 px-2">
                <span className="block text-[14px] font-black tracking-[0.2em] text-[#E9A83A] font-mono leading-none">
                  {passCode}
                </span>
                <span className="block text-[8px] font-bold uppercase tracking-widest text-white/70 mt-0.5 font-sans">
                  GATE PASS ID • PIN: {pin}
                </span>
              </div>

              <div className="text-[10px] font-black tracking-wider text-white/90 uppercase font-mono">
                <span>{dateFormatted}</span>
                <span className="mx-1.5 text-[#E9A83A]">•</span>
                <span>{startTimeFormatted}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Offline scan notice */}
      <div className="mx-auto max-w-[840px] flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#EAF2EC] border border-[#006B4F]/20 p-2.5 px-4 text-[12px] font-bold text-[#006B4F]">
        <div className="flex items-center gap-2">
          <Icon name="shield" size={15} className="shrink-0" />
          <span>Valid at all Nashik sector gates. Works offline without internet.</span>
        </div>
        <button
          type="button"
          onClick={() => setShowDemoModal(true)}
          className="text-[11px] font-mono font-black text-[#8B5A2B] hover:underline uppercase tracking-wider cursor-pointer"
        >
          [ ▶ Run Parking Demo ]
        </button>
      </div>

      {/* ACTION BUTTONS */}
      {showActions && (
        <div className="mx-auto max-w-[840px] pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Run Parking Demo */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowDemoModal(true)}
              className="bg-amber-50 hover:bg-amber-100 text-[#8B5A2B] border border-amber-300 font-black text-[12.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs cursor-pointer py-3.5"
            >
              <span>▶ Run Demo</span>
            </Button>

            {/* Download Ticket */}
            <Button
              variant="secondary"
              size="lg"
              loading={downloading}
              onClick={handleDownload}
              className="bg-white hover:bg-[#FAF7F2] text-[#17212B] border border-[#E2DDD3] font-black text-[12.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs cursor-pointer py-3.5"
            >
              <Icon name="ticket" size={16} />
              <span>Download</span>
            </Button>

            {/* Share Ticket */}
            <Button
              variant="secondary"
              size="lg"
              onClick={handleShare}
              className="bg-white hover:bg-[#FAF7F2] text-[#17212B] border border-[#E2DDD3] font-black text-[12.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs cursor-pointer py-3.5"
            >
              <Icon name="share" size={15} />
              <span>Share</span>
            </Button>

            {/* View My Bookings */}
            <Button
              variant="accent"
              size="lg"
              onClick={() => {
                onClose?.()
                navigate('/bookings')
              }}
              className="bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] font-black text-[12.5px] uppercase tracking-wider shadow-md flex items-center justify-center gap-1 cursor-pointer py-3.5"
            >
              <span>My Bookings</span>
              <Icon name="arrowRight" size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Parking Demo Modal */}
      {showDemoModal && (
        <ParkingDemoModal
          booking={booking}
          spot={spot}
          onClose={() => setShowDemoModal(false)}
        />
      )}
    </div>
  )
}
