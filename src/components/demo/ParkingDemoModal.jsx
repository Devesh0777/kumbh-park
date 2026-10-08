import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import QRCode from '@/components/ui/QRCode'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import DigitalParkingTicket from '@/components/booking/DigitalParkingTicket'

/**
 * Demo States Machine:
 * 1. BOOKED
 * 2. ENTRY_SCANNING
 * 3. ENTRY_VERIFIED (PARKING_ACTIVE) - Ticket punched
 * 4. EXIT_SCANNING
 * 5. COMPLETED - Ticket exit cut
 */

export default function ParkingDemoModal({ booking, spot, onClose }) {
  const navigate = useNavigate()
  const [demoState, setDemoState] = useState('BOOKED')
  const [scanProgress, setScanProgress] = useState(0)

  // Dynamic ticket details
  const passCode = booking?.code || 'NPC-CFLCH'
  const spotTitle = booking?.title || spot?.title || 'Driveway Behind Sagar Petrol Pump'
  const amount = booking?.amount ?? 87
  const entryTime = '10:42 PM'
  const exitTime = '11:58 PM'

  // Simulated scanning timers
  useEffect(() => {
    let interval = null
    if (demoState === 'ENTRY_SCANNING') {
      setScanProgress(0)
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setDemoState('ENTRY_VERIFIED')
            return 100
          }
          return prev + 25
        })
      }, 350)
    } else if (demoState === 'EXIT_SCANNING') {
      setScanProgress(0)
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setDemoState('COMPLETED')
            return 100
          }
          return prev + 25
        })
      }, 350)
    }
    return () => clearInterval(interval)
  }, [demoState])

  const steps = [
    { id: 'BOOKED', label: '1. BOOKED' },
    { id: 'ENTRY_SCANNING', label: '2. ENTRY SCAN' },
    { id: 'ENTRY_VERIFIED', label: '3. PARKED' },
    { id: 'EXIT_SCANNING', label: '4. EXIT SCAN' },
    { id: 'COMPLETED', label: '5. COMPLETED' },
  ]

  const getCurrentStepIndex = () => {
    switch (demoState) {
      case 'BOOKED':
        return 0
      case 'ENTRY_SCANNING':
        return 1
      case 'ENTRY_VERIFIED':
        return 2
      case 'EXIT_SCANNING':
        return 3
      case 'COMPLETED':
        return 4
      default:
        return 0
    }
  }

  const handleReset = () => {
    setDemoState('BOOKED')
    setScanProgress(0)
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 bg-[#0E151D]/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#FAF7F2] border-2 border-[#E2DDD3] shadow-2xl overflow-hidden my-auto">
        {/* ----------------- DEMO HEADER BAR ----------------- */}
        <div className="bg-[#17212B] text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-[#006B4F] text-[#FFD166] text-[12px] font-black font-mono">
              KP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-black uppercase font-serif text-white tracking-wider">
                  KUMBH PARK PARKING DEMO
                </span>
                <span className="rounded bg-[#E9A83A] px-2 py-0.2 text-[9px] font-mono font-black text-[#17212B] uppercase">
                  DEMO USER: DEVV
                </span>
              </div>
              <p className="text-[10.5px] text-white/70">
                Simulate gate entry scan, ticket punch, active session & exit cut.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* ----------------- 5-STEP PROGRESS BAR ----------------- */}
        <div className="bg-[#EFEADF] px-4 py-2.5 border-b border-[#E2DDD3] overflow-x-auto">
          <div className="flex items-center justify-between min-w-[480px]">
            {steps.map((s, idx) => {
              const currentIdx = getCurrentStepIndex()
              const isActive = idx === currentIdx
              const isPassed = idx < currentIdx

              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-all',
                      isActive
                        ? 'bg-[#006B4F] text-white ring-2 ring-[#006B4F]/30 shadow-xs'
                        : isPassed
                          ? 'bg-[#E9A83A] text-[#17212B]'
                          : 'bg-white/60 text-[#8A7E72]',
                    )}
                  >
                    <span>{s.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <span className="text-[9px] text-[#A39788]">➔</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ----------------- MAIN DEMO CONTENT CANVAS ----------------- */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* STEP 1: BOOKED STATE */}
          {demoState === 'BOOKED' && (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1 text-[11.5px] font-mono font-bold text-blue-700 border border-blue-500/20">
                <span>STATUS: BOOKED & CONFIRMED</span>
              </div>
              <h3 className="text-lg font-bold text-[#17212B]">
                Your Parking Pass is Ready for Arrival
              </h3>
              <p className="text-[12.5px] text-[#66706B] max-w-md mx-auto">
                Arriving at <strong className="text-[#17212B]">{spotTitle}</strong>. Click below to simulate arriving at the gate and scanning the entry QR code.
              </p>

              <div className="pt-1 flex items-center justify-center gap-3">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => setDemoState('ENTRY_SCANNING')}
                  className="bg-[#006B4F] hover:bg-[#00472B] text-white px-7 py-3 font-bold text-[13.5px] uppercase tracking-wider shadow-lg cursor-pointer rounded-xl"
                  icon={<Icon name="qr" size={17} />}
                >
                  [ SCAN AT ENTRANCE ]
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: ENTRY SCANNING */}
          {demoState === 'ENTRY_SCANNING' && (
            <div className="text-center space-y-3 py-2">
              <div className="relative mx-auto size-44 rounded-2xl bg-[#17212B] p-4 text-white border-4 border-[#006B4F] shadow-2xl flex flex-col items-center justify-center overflow-hidden">
                <div
                  className="absolute left-0 right-0 h-1 bg-[#E9A83A] shadow-[0_0_15px_#E9A83A] transition-all duration-300"
                  style={{ top: `${scanProgress}%` }}
                />
                <QRCode value={`DEMO_ENTRY_${passCode}`} size={100} className="p-1 bg-white rounded-lg" />
                <span className="mt-2 text-[9.5px] font-mono font-bold uppercase text-[#FFD166]">
                  SCANNING ENTRY QR... {scanProgress}%
                </span>
              </div>
              <p className="text-[12px] font-bold text-[#006B4F]">Verifying gate pass credentials...</p>
            </div>
          )}

          {/* STEP 3: ENTRY VERIFIED / PARKED STATE (TICKET PUNCHED) */}
          {demoState === 'ENTRY_VERIFIED' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center space-y-0.5 shadow-sm">
                <div className="inline-flex items-center gap-2 text-emerald-800 font-black text-[14px] uppercase font-serif">
                  <span className="size-5 rounded-full bg-emerald-600 text-white grid place-items-center text-[11px]">✓</span>
                  <span>ENTRY APPROVED • GATE PASS VERIFIED</span>
                </div>
                <p className="text-[11.5px] text-emerald-700 font-medium">
                  Entry Time recorded at <strong>{entryTime}</strong>. Ticket corner physically punched.
                </p>
              </div>

              {/* Active Parking Session Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-[#E2DDD3]">
                <div className="text-center border-r border-gray-200 pr-2">
                  <span className="text-[9.5px] font-mono font-bold text-gray-500 uppercase block">ENTRY TIME</span>
                  <span className="text-[13px] font-black text-[#17212B] font-mono">{entryTime}</span>
                </div>
                <div className="text-center border-r border-gray-200 pr-2">
                  <span className="text-[9.5px] font-mono font-bold text-gray-500 uppercase block">RESERVED</span>
                  <span className="text-[13px] font-black text-[#17212B] font-mono">2 HOURS</span>
                </div>
                <div className="text-center border-r border-gray-200 pr-2">
                  <span className="text-[9.5px] font-mono font-bold text-emerald-600 uppercase block">ELAPSED</span>
                  <span className="text-[13px] font-black text-emerald-600 font-mono">01:14</span>
                </div>
                <div className="text-center">
                  <span className="text-[9.5px] font-mono font-bold text-amber-600 uppercase block">REMAINING</span>
                  <span className="text-[13px] font-black text-amber-600 font-mono">00:46</span>
                </div>
              </div>

              <div className="text-center pt-1">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => setDemoState('EXIT_SCANNING')}
                  className="bg-[#8B2E21] hover:bg-[#6E2217] text-white px-7 py-3 font-bold text-[13.5px] uppercase tracking-wider shadow-lg cursor-pointer rounded-xl"
                  icon={<Icon name="qr" size={17} />}
                >
                  [ SCAN AT EXIT ]
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: EXIT SCANNING */}
          {demoState === 'EXIT_SCANNING' && (
            <div className="text-center space-y-3 py-2">
              <div className="relative mx-auto size-44 rounded-2xl bg-[#17212B] p-4 text-white border-4 border-[#8B2E21] shadow-2xl flex flex-col items-center justify-center overflow-hidden">
                <div
                  className="absolute left-0 right-0 h-1 bg-[#E9A83A] shadow-[0_0_15px_#E9A83A] transition-all duration-300"
                  style={{ top: `${scanProgress}%` }}
                />
                <QRCode value={`DEMO_EXIT_${passCode}`} size={100} className="p-1 bg-white rounded-lg" />
                <span className="mt-2 text-[9.5px] font-mono font-bold uppercase text-[#FFD166]">
                  SCANNING EXIT QR... {scanProgress}%
                </span>
              </div>
              <p className="text-[12px] font-bold text-[#8B2E21]">Calculating session duration & completing checkout...</p>
            </div>
          )}

          {/* STEP 5: COMPLETED STATE */}
          {demoState === 'COMPLETED' && (
            <div className="space-y-3 text-center">
              <div className="rounded-xl bg-slate-900 text-white p-4 space-y-1.5 border border-slate-700 shadow-lg">
                <div className="inline-flex items-center gap-2 text-emerald-400 font-black text-[16px] uppercase font-serif">
                  <span>✓ PARKING JOURNEY COMPLETED</span>
                </div>
                <p className="text-[12px] text-slate-300">
                  Exit verified at <strong>{exitTime}</strong>. Ticket edge clipped/perforated. Session settled.
                </p>

                <div className="pt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left bg-slate-800/80 p-2.5 rounded-lg text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px]">ENTRY</span>
                    <span className="text-white font-bold">{entryTime}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">EXIT</span>
                    <span className="text-white font-bold">{exitTime}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">DURATION</span>
                    <span className="text-white font-bold">1h 16m</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">AMOUNT PAID</span>
                    <span className="text-[#E9A83A] font-bold">{money(amount)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-[#17212B] bg-white text-[#17212B] font-bold text-[12px] uppercase tracking-wider rounded-xl py-2.5 px-4 cursor-pointer"
                >
                  Reset Demo
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onClose?.()
                    navigate('/search')
                  }}
                  className="bg-[#006B4F] text-white font-bold text-[12px] uppercase tracking-wider rounded-xl py-2.5 px-5 cursor-pointer"
                >
                  Book Another Parking
                </Button>
              </div>
            </div>
          )}

          {/* REUSED DIGITAL PARKING TICKET COMPONENT (WITH DYNAMIC EXIT CUT ANIMATION) */}
          <div className="relative">
            <DigitalParkingTicket
              booking={booking}
              spot={spot}
              showActions={false}
              ticketState={
                demoState === 'COMPLETED'
                  ? 'COMPLETED'
                  : demoState === 'EXIT_SCANNING'
                    ? 'EXIT_VERIFIED'
                    : demoState === 'ENTRY_VERIFIED'
                      ? 'PARKING_ACTIVE'
                      : 'CONFIRMED'
              }
              isAnimatingCut={demoState === 'EXIT_SCANNING'}
            />
          </div>
        </div>

        {/* ----------------- FOOTER ACTIONS ----------------- */}
        <div className="bg-[#EFEADF] px-5 py-3 border-t border-[#E2DDD3] flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11.5px] font-bold text-[#8B2E21] hover:underline cursor-pointer"
          >
            Reset Demo State
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onClose}
            className="bg-white border-[#E2DDD3] text-[#17212B] font-bold text-[12px] cursor-pointer"
          >
            Close Demo
          </Button>
        </div>
      </div>
    </div>
  )
}
