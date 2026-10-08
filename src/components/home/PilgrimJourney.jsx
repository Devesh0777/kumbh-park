import { useEffect, useRef, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * Real Nashik Pilgrimage Stop Definitions with Authentic Photographs
 */
const PILGRIM_STOPS = [
  {
    id: 'stop-01',
    number: '01',
    distance: '0 KM',
    title: 'NASHIK ROAD JUNCTION',
    subtitle: 'Gateway to Maha Kumbh • Transit Hub',
    category: 'ARRIVAL GATEWAY',
    side: 'left',
    description:
      'Where high-speed express trains and state highways converge. Pilgrims transition into verified local transit and parking perimeter routes.',
    signText: 'NASHIK RD • TRANSIT HUB',
    signSub: 'PILGRIMS WELCOME • MELA 2027',
    tag: 'Start Point',
    tip: 'Heavy traffic cordons start 4km ahead. Switch to pre-booked local parking.',
    photo: '/images/nashik-station.jpg',
    photoCaption: 'NASHIK ROAD STATION • TRANSIT GATEWAY',
    parkingNotice: null,
  },
  {
    id: 'stop-02',
    number: '02',
    distance: '1.2 KM',
    title: 'RAMKUND & GODAVARI GHAT',
    subtitle: 'Sacred Shahi Snan Kund • Holy River Steps',
    category: 'SACRED EPIDEMIC',
    side: 'right',
    description:
      'The sacred epicenter of Kumbh Mela where Lord Rama bathed during exile. Millions take holy dips on auspicious Shahi Snan dates.',
    signText: 'RAMKUND GHAT ➔ 230 M',
    signSub: 'PEDESTRIANS ONLY • NO CARS',
    tag: 'Holy Ghat',
    tip: 'Inner 1.5 km is strictly sealed to private vehicles. Park at Ramkund North compound.',
    photo: '/images/ramkund-ghat.jpg',
    photoCaption: 'RAMKUND GHAT • GODAVARI RIVER',
    parkingNotice: {
      zoneId: 'z1',
      zoneName: 'Ramkund Central Ghats',
      spotsAvail: 8,
      walkTime: '3 min walk',
    },
  },
  {
    id: 'stop-03',
    number: '03',
    distance: '2.4 KM',
    title: 'PANCHAVATI & SITA GUFA',
    subtitle: 'Five Sacred Banyan Trees • Historic Grove',
    category: 'HERITAGE GROVE',
    side: 'left',
    description:
      'The historic hermitage where Lord Rama, Sita, and Lakshmana resided. The five ancient Banyan trees provide shaded sanctuary.',
    signText: 'PANCHAVATI ➔ 450 M',
    signSub: 'HISTORIC BANYAN PRECINCT',
    tag: 'Sacred Grove',
    tip: 'Narrow heritage lanes. Pre-booked ashram compounds allow hassle-free visit.',
    photo: '/images/panchavati-grove.jpg',
    photoCaption: 'PANCHAVATI • SITA GUFA SHRINE',
    parkingNotice: {
      zoneId: 'z2',
      zoneName: 'Panchavati East',
      spotsAvail: 12,
      walkTime: '5 min walk',
    },
  },
  {
    id: 'stop-04',
    number: '04',
    distance: '3.1 KM',
    title: 'KALARAM TEMPLE',
    subtitle: 'Architectural Marvel in Pure Black Basalt',
    category: 'ARCHITECTURAL WONDER',
    side: 'right',
    description:
      'Ancient temple built in 1782 using 2,000 tonnes of black basalt stone from Ramshej hills with gold-plated kalash shikhara.',
    signText: 'KALARAM MANDIR ➔ 300 M',
    signSub: 'ANCIENT BASALT ARCHITECTURE',
    tag: 'Ancient Temple',
    tip: 'Peak evening aarti sees heavy footfall. Leave vehicle in verified lot.',
    photo: '/images/kalaram-temple.jpg',
    photoCaption: 'KALARAM TEMPLE • PANCHAVATI',
    parkingNotice: null,
  },
  {
    id: 'stop-05',
    number: '05',
    distance: '3.8 KM',
    title: 'KAPALESHWAR & RIVERFRONT',
    subtitle: 'Ancient Shiva Shrine Overlooking the River',
    category: 'RIVERFRONT SANCTUARY',
    side: 'left',
    description:
      'Historic Shiva shrine situated atop a natural promontory overlooking Godavari river, offering panoramic sunrise vistas.',
    signText: 'KAPALESHWAR ➔ 600 M',
    signSub: 'GODAVARI RIVER WALKWAY',
    tag: 'Riverfront',
    tip: 'Breathtaking sunrise views over the ghats. Accessible via riverfront path.',
    photo: '/images/kapaleshwar-temple.jpg',
    photoCaption: 'KAPALESHWAR • GODAVARI OVERLOOK',
    parkingNotice: {
      zoneId: 'z1',
      zoneName: 'Godavari South Bank',
      spotsAvail: 6,
      walkTime: '4 min walk',
    },
  },
  {
    id: 'stop-06',
    number: '06',
    distance: 'FEATURE',
    title: 'KUMBH PARK MOBILITY NETWORK',
    subtitle: 'Park Once. Walk The Pilgrimage.',
    category: 'SMART MOBILITY',
    side: 'center',
    description:
      'Pre-book verified private gated driveways and ashram lands right outside police barricades. Guaranteed space with instant offline QR gate passes.',
    signText: 'KUMBH PARK VERIFIED ZONE',
    signSub: '100% GUARANTEED RESERVED SPOTS',
    tag: 'Smart Parking',
    tip: 'Over 140+ verified spots across 6 Kumbh sectors with direct host settlements.',
    photo: '/images/kumbh-parking-lot.jpg',
    photoCaption: 'VERIFIED PRIVATE COMPOUND • NASHIK',
    parkingNotice: null,
  },
  {
    id: 'stop-07',
    number: '07',
    distance: '28 KM',
    title: 'TRIMBAKESHWAR & KUSHAVARTA',
    subtitle: 'Holy Jyotirlinga • Brahmagiri Mountain',
    category: 'JYOTIRLINGA SHRINE',
    side: 'right',
    description:
      'One of the 12 sacred Jyotirlingas of Lord Shiva and the birthplace of the Godavari river at the foot of Brahmagiri hills.',
    signText: 'TRIMBAKESHWAR ➔ 28 KM',
    signSub: 'NH-848 WEST CORRIDOR',
    tag: 'Jyotirlinga',
    tip: 'Expressway access available. Dedicated high-capacity lots for tourist buses.',
    photo: '/images/trimbakeshwar-temple.jpg',
    photoCaption: 'TRIMBAKESHWAR TEMPLE • BRAHMAGIRI',
    parkingNotice: {
      zoneId: 'z5',
      zoneName: 'Trimbak Highway Hub',
      spotsAvail: 15,
      walkTime: '6 min walk',
    },
  },
  {
    id: 'stop-08',
    number: '08',
    distance: 'DESTINATION',
    title: 'YOUR PILGRIMAGE STARTS HERE',
    subtitle: 'Peace of Mind for You & Your Family',
    category: 'DESTINATION REACHED',
    side: 'center',
    description:
      'Bypass festival gridlock. Secure your verified parking spot now or list your unused space to welcome pilgrims to holy Nashik.',
    signText: 'MELA PARKING READY',
    signSub: 'KUMBH PARK SMART NETWORK',
    tag: 'Complete',
    tip: 'Instant confirmation. Free cancellation until check-in time.',
    photo: '/images/nashik-kumbh-overview.jpg',
    photoCaption: 'GODAVARI RIVERFRONT • NASHIK KUMBH',
    parkingNotice: null,
  },
]

export default function PilgrimJourney() {
  const navigate = useNavigate()
  const sectionRef = useRef(null)
  const pathRef = useRef(null)

  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [markerPos, setMarkerPos] = useState({ x: 500, y: 40, angle: 0 })
  const [pathTotalLength, setPathTotalLength] = useState(3000)

  // Curvature coordinates for the winding trail across 8 stops
  const svgPathD = useMemo(() => {
    return `
      M 500,40
      C 460,180 320,280 300,420
      C 280,560 680,680 720,840
      C 760,1000 240,1120 280,1320
      C 320,1500 750,1620 720,1800
      C 690,1980 250,2100 290,2300
      C 320,2480 500,2580 500,2720
      C 500,2860 740,2960 720,3140
      C 700,3300 500,3420 500,3580
    `
  }, [])

  // Milestone node positions along SVG path (viewBox 0 0 1000 3600)
  const milestoneNodes = [
    { x: 500, y: 40 },
    { x: 300, y: 420 },
    { x: 720, y: 840 },
    { x: 280, y: 1320 },
    { x: 720, y: 1800 },
    { x: 290, y: 2300 },
    { x: 500, y: 2720 },
    { x: 720, y: 3140 },
  ]

  // Initialize SVG path length
  useEffect(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength()
        if (len && !isNaN(len) && len > 0) {
          setPathTotalLength(len)
        }
      } catch {
        // Fallback
      }
    }
  }, [svgPathD])

  // Scroll Listener with rAF for 60fps performance and smooth marker translation
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!sectionRef.current) return

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = sectionRef.current.getBoundingClientRect()
          const windowHeight = window.innerHeight
          const totalScrollable = rect.height - windowHeight

          const rawProgress = -rect.top / (totalScrollable > 0 ? totalScrollable : 1)
          const clamped = Math.max(0, Math.min(1, rawProgress))

          setScrollProgress(clamped)

          const stepCount = PILGRIM_STOPS.length
          const currentIdx = Math.max(0, Math.min(stepCount - 1, Math.floor(clamped * stepCount)))
          setActiveStopIndex(currentIdx)

          // Calculate precise marker position and rotation angle along path
          if (pathRef.current) {
            try {
              const len = pathRef.current.getTotalLength()
              if (len && !isNaN(len) && len > 0) {
                const targetLen = Math.max(0, Math.min(len, clamped * len))
                const p1 = pathRef.current.getPointAtLength(targetLen)
                const p2 = pathRef.current.getPointAtLength(Math.min(len, targetLen + 2))
                
                if (p1 && !isNaN(p1.x) && !isNaN(p1.y)) {
                  let angle = 0
                  if (p2 && !isNaN(p2.x) && !isNaN(p2.y)) {
                    angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI)
                  }
                  setMarkerPos({ x: p1.x, y: p1.y, angle })
                }
              }
            } catch {
              // Fallback
            }
          }

          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToStop = (index) => {
    const el = document.getElementById(`pilgrim-${PILGRIM_STOPS[index].id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#141B22] text-[#FAF6EE] pt-14 pb-24 select-none"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at top, rgba(233,168,58,0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 40%, rgba(0,107,79,0.08) 0%, transparent 60%),
          linear-gradient(180deg, #11171D 0%, #151D25 40%, #131A21 80%, #0F1419 100%)
        `,
      }}
    >
      {/* Background Parallax Grid Texture (Layer 1) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] transition-transform duration-300"
        style={{
          transform: `translateY(${scrollProgress * 40}px)`,
          backgroundImage: `
            linear-gradient(to right, #FAF6EE 1px, transparent 1px),
            linear-gradient(to bottom, #FAF6EE 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
        }}
      />

      {/* =========================================================================
          1. SECTION TITLE: "WELCOME TO NASHIK" HEADER
      ========================================================================= */}
      <div className="relative z-20 mx-auto max-w-4xl px-4 text-center sm:px-6 mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 border border-white/15 backdrop-blur-md text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#E9A83A] shadow-md">
          <span className="size-2 rounded-full bg-[#E9A83A] animate-ping" />
          PILGRIM ROAD TRIP • MAHA KUMBH 2027
        </div>

        <h2 className="mt-4 text-4xl sm:text-6xl font-black uppercase font-serif tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] leading-[1.05]">
          WELCOME <span className="text-[#E9A83A] font-serif italic lowercase font-normal">to</span> NASHIK
        </h2>

        <p className="mt-2 text-[13px] sm:text-[15px] font-extrabold uppercase tracking-[0.2em] text-[#A3B3A9] font-sans">
          THE KUMBH PARK PILGRIM JOURNEY
        </p>

        <p className="mx-auto mt-3 max-w-lg text-[13.5px] sm:text-[14.5px] font-medium leading-relaxed text-[#D6D0C4]/80">
          Scroll down to travel through sacred Ghats, ancient Panchavati groves, and Jyotirlinga shrines with verified parking perimeter guidance.
        </p>

        <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-[#006B4F]/25 border border-[#006B4F]/40 px-4 py-2 backdrop-blur-md shadow-md">
          <span className="text-lg animate-bounce">↓</span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#E9A83A]">
            SCROLL TO DRIVE PILGRIMAGE ROAD
          </span>
          <span className="text-[10.5px] font-mono font-black text-white/80 bg-white/10 px-2 py-0.5 rounded">
            {String(activeStopIndex + 1).padStart(2, '0')} / {String(PILGRIM_STOPS.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* =========================================================================
          2. STICKY MILESTONE PROGRESS BAR
      ========================================================================= */}
      <div className="sticky top-4 z-40 mx-auto max-w-xl px-4 pointer-events-none mb-8">
        <div className="pointer-events-auto flex items-center justify-between gap-1 rounded-xl bg-[#17212B]/95 border border-white/15 px-3.5 py-2 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="grid size-5.5 place-items-center rounded-md bg-[#E9A83A] text-[10px] font-black text-[#17212B]">
              🚩
            </span>
            <div className="leading-tight">
              <span className="text-[9px] font-mono font-black text-[#E9A83A] uppercase tracking-wider block">
                CURRENT MILESTONE
              </span>
              <span className="text-[11.5px] font-bold text-white block truncate max-w-[180px] sm:max-w-[240px]">
                {PILGRIM_STOPS[activeStopIndex]?.title || 'Nashik Arrival'}
              </span>
            </div>
          </div>

          {/* Quick Clickable Stop Dots */}
          <div className="flex items-center gap-1.5">
            {PILGRIM_STOPS.map((stop, idx) => {
              const isActive = idx === activeStopIndex
              const isPassed = idx < activeStopIndex
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => scrollToStop(idx)}
                  aria-label={`Jump to ${stop.title}`}
                  className={cn(
                    'size-2 rounded-full transition-all duration-300 cursor-pointer',
                    isActive
                      ? 'bg-[#E9A83A] ring-4 ring-[#E9A83A]/30 scale-125'
                      : isPassed
                        ? 'bg-[#006B4F]'
                        : 'bg-white/20 hover:bg-white/40',
                  )}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN ROAD MAP CONTAINER (SVG TRAIL + DESTINATIONS)
      ========================================================================= */}
      <div className="relative mx-auto max-w-5xl px-3 sm:px-6">
        {/* SVG Winding Dotted Road Canvas */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            viewBox="0 0 1000 3600"
            className="w-full h-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="activeTrailGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD166" />
                <stop offset="100%" stopColor="#E9A83A" />
              </linearGradient>

              {/* Refined Subtle Glow Filter for Active Marker & Trail */}
              <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* 1. Muted Upcoming Background Road Track */}
            <path
              d={svgPathD}
              fill="none"
              stroke="#3D3425"
              strokeWidth="5"
              strokeDasharray="8 10"
              strokeLinecap="round"
            />

            {/* 2. Scroll-Progress Bright Active Saffron Road Trail */}
            <path
              ref={pathRef}
              d={svgPathD}
              fill="none"
              stroke="url(#activeTrailGrad)"
              strokeWidth="6"
              strokeDasharray="10 10"
              strokeDashoffset={pathTotalLength * (1 - scrollProgress)}
              strokeLinecap="round"
              filter="url(#subtleGlow)"
              className="transition-[stroke-dashoffset] duration-75 ease-out"
            />

            {/* 3. Destination SVG Nodes (Small refined nodes along path) */}
            {milestoneNodes.map((node, i) => {
              const isNodeActive = i === activeStopIndex
              const isNodePassed = i < activeStopIndex
              return (
                <g key={i} transform={`translate(${node.x}, ${node.y})`}>
                  <circle
                    r={isNodeActive ? 10 : isNodePassed ? 7 : 5}
                    fill={isNodeActive ? '#FFD166' : isNodePassed ? '#006B4F' : '#3D3425'}
                    stroke="#17212B"
                    strokeWidth="2"
                    filter={isNodeActive ? 'url(#subtleGlow)' : undefined}
                    className="transition-all duration-300"
                  />
                  {isNodeActive && (
                    <circle r="14" fill="#FFD166" fillOpacity="0.3" className="animate-ping" />
                  )}
                </g>
              )
            })}

            {/* 4. REFINED SMALL TRAVEL MARKER (Replaces old big circle marker!) */}
            <g
              transform={`translate(${markerPos.x}, ${markerPos.y})`}
              className="transition-transform duration-100 ease-out"
            >
              {/* Subtle Short Saffron Trail Glow */}
              <circle r="14" fill="#E9A83A" fillOpacity="0.2" filter="url(#subtleGlow)" />
              
              {/* Compact Travel Location Badge (30px size) */}
              <g transform="translate(-14, -28)">
                {/* Location Pin Shape */}
                <path
                  d="M 14 0 C 6.268 0 0 6.268 0 14 C 0 24.5 14 36 14 36 C 14 36 28 24.5 28 14 C 28 6.268 21.732 0 14 0 Z"
                  fill="#006B4F"
                  stroke="#FFD166"
                  strokeWidth="2"
                  filter="url(#subtleGlow)"
                />
                {/* Tiny "P" / Compass Icon inside Pin */}
                <circle cx="14" cy="13" r="6" fill="#17212B" />
                <text x="14" y="16.5" textAnchor="middle" fill="#FFD166" fontSize="9" fontWeight="900" fontFamily="sans-serif">
                  P
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* =====================================================================
            4. COMPACT DESTINATION JOURNEY CARDS (Reduced size by 25-35%)
        ===================================================================== */}
        <div className="relative z-10 space-y-24 sm:space-y-36 py-8">
          {PILGRIM_STOPS.map((stop, index) => {
            const isCenter = stop.side === 'center'
            const isLeft = stop.side === 'left'
            const isActive = index === activeStopIndex
            const isPassed = index <= activeStopIndex

            return (
              <div
                key={stop.id}
                id={`pilgrim-${stop.id}`}
                className={cn(
                  'relative flex items-center transition-all duration-500',
                  isCenter
                    ? 'justify-center'
                    : isLeft
                      ? 'justify-start md:pr-[42%]'
                      : 'justify-end md:pl-[42%]',
                )}
              >
                {/* Destination Card Container (Compact target size 500-560px) */}
                <div
                  className={cn(
                    'w-full max-w-[520px] rounded-2xl p-4 sm:p-5 transition-all duration-500 shadow-xl relative border backdrop-blur-md',
                    isActive
                      ? 'bg-[#1C2631] border-[#E9A83A] ring-2 ring-[#E9A83A]/30 scale-[1.01] opacity-100 translate-y-0'
                      : isPassed
                        ? 'bg-[#18212B]/90 border-white/15 opacity-80 scale-[0.98]'
                        : 'bg-[#131920]/70 border-white/5 opacity-55 scale-[0.96] translate-y-4',
                    !isCenter && isLeft && !isActive && '-translate-x-3',
                    !isCenter && !isLeft && !isActive && 'translate-x-3',
                  )}
                >
                  {/* Wooden Highway Signboard Header */}
                  <div className="relative -mt-7 mb-3 mx-auto w-[90%] overflow-hidden rounded-lg bg-gradient-to-b from-[#7A4E24] to-[#4F3115] p-2 text-center text-white border border-[#D4A373] shadow-md">
                    <div className="flex items-center justify-between border-b border-[#D4A373]/40 pb-0.5 text-[9px] font-mono font-bold tracking-widest text-[#FFE8D6] uppercase">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-[#E9A83A]" />
                        {stop.tag}
                      </span>
                      <span>{stop.distance}</span>
                    </div>
                    <div className="pt-0.5 text-[12px] sm:text-[13.5px] font-black uppercase tracking-wider font-serif text-[#FAF0CA]">
                      {stop.signText}
                    </div>
                  </div>

                  {/* Top Category & Stop Number */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="rounded bg-[#006B4F] px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white">
                      STOP {stop.number} • {stop.category}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#E9A83A]">
                      {stop.distance}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="mt-2 text-lg sm:text-xl font-black uppercase font-serif tracking-tight text-white leading-tight">
                    {stop.title}
                  </h3>
                  <p className="mt-0.5 text-[10.5px] font-bold text-[#A3B3A9] uppercase tracking-wider">
                    {stop.subtitle}
                  </p>

                  {/* REAL PHOTOGRAPH TRAVEL JOURNAL CONTAINER */}
                  <div className="my-3 relative overflow-hidden rounded-xl border border-white/15 bg-[#0F141A] p-1.5 shadow-inner">
                    <div className="relative overflow-hidden rounded-lg bg-[#FAF6EE] p-1 shadow-md">
                      <div className="h-32 sm:h-38 w-full overflow-hidden rounded bg-[#FAF6EE] relative">
                        <img
                          src={stop.photo}
                          alt={stop.title}
                          className="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
                          loading="lazy"
                        />
                        {/* Location Caption Tag */}
                        <div className="absolute bottom-1 left-1.5 right-1.5 text-center text-[9.5px] font-mono font-bold text-[#17212B] uppercase tracking-wider bg-white/90 backdrop-blur-xs py-0.5 rounded shadow-xs">
                          {stop.photoCaption}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Narrative Body Text */}
                  <p className="text-[12px] leading-relaxed text-[#D6D0C4]/85">
                    {stop.description}
                  </p>

                  {/* Helpful Local Tip Box */}
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 p-2 text-[10.5px] text-[#A3B3A9]">
                    <span className="text-[12px]">💡</span>
                    <p className="leading-snug">
                      <strong className="text-white">Route Advisory:</strong> {stop.tip}
                    </p>
                  </div>

                  {/* -------------------------------------------------------------
                      PARKING PERIMETER INTEGRATION (Animated when active)
                  ------------------------------------------------------------- */}
                  {stop.parkingNotice && (
                    <div
                      className={cn(
                        'mt-3 rounded-xl border p-2.5 space-y-1.5 transition-all duration-300',
                        isActive
                          ? 'bg-gradient-to-r from-[#006B4F]/35 via-[#006B4F]/20 to-transparent border-[#006B4F]/60'
                          : 'bg-white/5 border-white/10',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="grid size-5 place-items-center rounded bg-[#006B4F] text-white text-[10px] font-black">
                            P
                          </span>
                          <span className="text-[10.5px] font-black uppercase tracking-wider text-[#E9A83A]">
                            PARKING NEAR THIS GHAT
                          </span>
                        </div>
                        <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {stop.parkingNotice.spotsAvail} bays open
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-white/80 font-medium truncate max-w-[180px]">
                          {stop.parkingNotice.zoneName} ({stop.parkingNotice.walkTime})
                        </span>
                        <Link
                          to={`/search?zone=${stop.parkingNotice.zoneId}`}
                          className="font-black text-[#E9A83A] hover:text-[#DC9B2E] transition-colors flex items-center gap-1 uppercase tracking-wider text-[10.5px]"
                        >
                          <span>Reserve Bay</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Special Feature CTA */}
                  {stop.side === 'center' && (
                    <div className="mt-4 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                      <Button
                        variant="accent"
                        size="md"
                        onClick={() => navigate('/search')}
                        className="bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] font-black text-[12px] uppercase tracking-wider flex-1 shadow-md py-2.5 cursor-pointer rounded-xl"
                      >
                        Find Guaranteed Parking →
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => navigate('/host/new')}
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-[12px] uppercase tracking-wider cursor-pointer rounded-xl"
                      >
                        List Space
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* =========================================================================
          5. FINAL DESTINATION REACHED CTA
      ========================================================================= */}
      <div className="relative z-20 mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#006B4F] to-[#044734] p-6 sm:p-10 text-white shadow-2xl border border-[#E9A83A]/40">
          <div className="inline-block rounded-lg bg-[#4F3115] px-4 py-1 text-center text-[#FAF0CA] border border-[#D4A373] text-[10px] font-mono font-black uppercase tracking-[0.2em] shadow-md mb-3">
            • FINAL DESTINATION •
          </div>

          <h3 className="text-2xl sm:text-4xl font-black uppercase font-serif tracking-tight text-white leading-tight">
            YOUR PILGRIMAGE STARTS HERE.
          </h3>

          <p className="mx-auto mt-2 max-w-md text-[13px] sm:text-[14.5px] font-medium text-[#FAF6EE]/90 leading-relaxed">
            Avoid festival gridlock. Secure your verified parking spot within walking distance of the sacred Ghats.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/search')}
              className="px-7 py-3.5 font-black text-[14px] uppercase tracking-wider bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] shadow-xl cursor-pointer rounded-xl"
            >
              Find Available Parking →
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/host/new')}
              className="px-6 py-3.5 font-bold text-[13.5px] uppercase tracking-wider border-white/40 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm cursor-pointer rounded-xl"
            >
              List Your Space
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
