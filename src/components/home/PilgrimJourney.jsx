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

  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)

  // Fixed static SVG Path definition (Winding pilgrim route printed on map)
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

  // Milestone node static positions on the map (viewBox 0 0 1000 3600)
  const milestoneNodes = [
    { x: 500, y: 40, label: 'Nashik Rd' },
    { x: 300, y: 420, label: 'Ramkund Ghat' },
    { x: 720, y: 840, label: 'Panchavati' },
    { x: 280, y: 1320, label: 'Kalaram' },
    { x: 720, y: 1800, label: 'Kapaleshwar' },
    { x: 290, y: 2300, label: 'Kumbh Park' },
    { x: 500, y: 2720, label: 'Trimbak' },
    { x: 720, y: 3140, label: 'Mela Zone' },
  ]

  // IntersectionObserver to detect active stop as user scrolls into landmark sections
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-25% 0px -25% 0px',
      threshold: 0.2,
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const stopId = entry.target.getAttribute('data-stop-index')
          if (stopId !== null) {
            const idx = parseInt(stopId, 10)
            if (!isNaN(idx)) {
              setActiveStopIndex(idx)
            }
          }
        }
      })
    }, observerOptions)

    PILGRIM_STOPS.forEach((stop, idx) => {
      const el = document.getElementById(`pilgrim-${stop.id}`)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  // Light scroll progress listener ONLY for subtle background camera parallax
  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!sectionRef.current) return
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = sectionRef.current.getBoundingClientRect()
          const totalHeight = rect.height - window.innerHeight
          if (totalHeight > 0) {
            const progress = Math.max(0, Math.min(1, -rect.top / totalHeight))
            setScrollProgress(progress)
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
      {/* Background Parallax Grid Texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] transition-transform duration-300"
        style={{
          transform: `translateY(${scrollProgress * 30}px)`,
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
          <span className="size-2 rounded-full bg-[#E9A83A]" />
          PILGRIM ROAD TRIP • MAHA KUMBH 2027
        </div>

        <h2 className="mt-4 text-4xl sm:text-6xl font-black uppercase font-serif tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] leading-[1.05]">
          WELCOME <span className="text-[#E9A83A] font-serif italic lowercase font-normal">to</span> NASHIK
        </h2>

        <p className="mt-2 text-[13px] sm:text-[15px] font-extrabold uppercase tracking-[0.2em] text-[#A3B3A9] font-sans">
          THE KUMBH PARK PILGRIM JOURNEY
        </p>

        <p className="mx-auto mt-3 max-w-lg text-[13.5px] sm:text-[14.5px] font-medium leading-relaxed text-[#D6D0C4]/80">
          Scroll down to explore sacred Ghats, ancient Panchavati groves, and Jyotirlinga shrines with verified parking perimeter guidance.
        </p>

        <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-[#006B4F]/25 border border-[#006B4F]/40 px-4 py-2 backdrop-blur-md shadow-md">
          <span className="text-lg">↓</span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#E9A83A]">
            SCROLL TO EXPLORE ROAD MAP
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
                CURRENT LANDMARK
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
          3. MAIN ROAD MAP CONTAINER (STATIC DOTTED ROUTE + CAMERA PARALLAX)
      ========================================================================= */}
      <div className="relative mx-auto max-w-5xl px-3 sm:px-6">
        {/* SVG Winding Dotted Road Canvas (100% STATIC ROUTE) */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-transform duration-500 ease-out"
          style={{
            transform: `translate3d(0, ${scrollProgress * 20}px, 0)`,
          }}
        >
          <svg
            viewBox="0 0 1000 3600"
            className="w-full h-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* STATIC ROAD TRACK BACKGROUND (Dark Charcoal) */}
            <path
              d={svgPathD}
              fill="none"
              stroke="#2B2117"
              strokeWidth="10"
              strokeLinecap="round"
            />

            {/* PERMANENT STATIC YELLOW/ORANGE DOTTED PILGRIM ROUTE (100% VISIBLE FROM START) */}
            <path
              d={svgPathD}
              fill="none"
              stroke="#E9A83A"
              strokeWidth="5"
              strokeDasharray="8 10"
              strokeLinecap="round"
              className="opacity-95"
            />

            {/* Milestone Map Nodes & Permanent Station Markers */}
            {milestoneNodes.map((node, i) => {
              const isActive = i === activeStopIndex
              const isPassed = i < activeStopIndex

              return (
                <g key={i} transform={`translate(${node.x}, ${node.y})`}>
                  {/* Outer Pulsing Halo for Active Node */}
                  {isActive && (
                    <circle
                      r="18"
                      fill="#E9A83A"
                      fillOpacity="0.25"
                      filter="url(#nodeGlow)"
                      className="animate-pulse"
                    />
                  )}

                  {/* Static Milestone Circle */}
                  <circle
                    r={isActive ? 11 : isPassed ? 8 : 6}
                    fill={isActive ? '#FFD166' : isPassed ? '#006B4F' : '#4E3E2E'}
                    stroke={isActive ? '#E9A83A' : '#17212B'}
                    strokeWidth="2.5"
                    className="transition-all duration-300"
                  />

                  {/* Landmark Node Label Tag */}
                  <g transform={`translate(${i % 2 === 0 ? 18 : -18}, ${i % 2 === 0 ? 4 : 4})`}>
                    <text
                      textAnchor={i % 2 === 0 ? 'start' : 'end'}
                      fill={isActive ? '#FFD166' : '#A39788'}
                      fontSize="11"
                      fontWeight={isActive ? '900' : '700'}
                      fontFamily="monospace"
                      letterSpacing="0.05em"
                    >
                      {node.label}
                    </text>
                  </g>
                </g>
              )
            })}
          </svg>
        </div>

        {/* =====================================================================
            4. SCROLL-TRIGGERED LANDMARK CARDS (THRESHOLD REVEAL LOGIC)
            Cards are INVISIBLE (opacity: 0) by default until scrolled near!
        ===================================================================== */}
        <div className="relative z-10 space-y-28 sm:space-y-36 py-8">
          {PILGRIM_STOPS.map((stop, index) => {
            const isCenter = stop.side === 'center'
            const isLeft = stop.side === 'left'
            const isActive = index === activeStopIndex
            const isPrevious = index === activeStopIndex - 1

            return (
              <div
                key={stop.id}
                id={`pilgrim-${stop.id}`}
                data-stop-index={index}
                className={cn(
                  'relative flex items-center transition-all duration-700 ease-out',
                  isCenter
                    ? 'justify-center'
                    : isLeft
                      ? 'justify-start md:pr-[40%]'
                      : 'justify-end md:pl-[40%]',
                )}
              >
                {/* -------------------------------------------------------------
                    STATIC MAP CONNECTOR LINE (Visual link to Map Node)
                ------------------------------------------------------------- */}
                {!isCenter && (
                  <div
                    className={cn(
                      'hidden md:block absolute top-1/2 -translate-y-1/2 h-0.5 border-t-2 border-dashed border-[#E9A83A]/40 z-0 transition-opacity duration-500',
                      isActive ? 'opacity-100' : 'opacity-20',
                      isLeft ? 'right-0 w-[40%]' : 'left-0 w-[40%]',
                    )}
                  />
                )}

                {/* Destination Card Container (Reveal on scroll near) */}
                <div
                  className={cn(
                    'w-full max-w-[510px] rounded-2xl p-4 sm:p-5 shadow-2xl relative border backdrop-blur-md transition-all duration-700 ease-out',
                    isActive
                      ? 'opacity-100 scale-100 translate-y-0 bg-[#1C2631] border-[#E9A83A] ring-2 ring-[#E9A83A]/30 pointer-events-auto z-20'
                      : isPrevious
                        ? 'opacity-40 scale-[0.96] -translate-y-2 bg-[#18212B]/90 border-white/10 pointer-events-auto z-10'
                        : 'opacity-0 scale-[0.94] translate-y-8 bg-[#131920]/40 border-white/5 pointer-events-none z-0',
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
                      PARKING PERIMETER INTEGRATION (Active Location Only)
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
