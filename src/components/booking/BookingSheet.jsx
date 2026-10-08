import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBooking, joinWaitlist } from '@/api'
import { dateTime, durationLabel, hoursLabel, money, relativeDay, time } from '@/lib/format'
import { quoteSummary, qrPayload } from '@/lib/id'
import { cn } from '@/lib/cn'
import { VEHICLE_TYPES } from '@/api/mock/spots'
import Sheet from '@/components/ui/Sheet'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Photo from '@/components/ui/Photo'
import QRCode from '@/components/ui/QRCode'
import StatusPill from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'

import DigitalParkingTicket from '@/components/booking/DigitalParkingTicket'

const HOURLY_PRESETS = [1, 2, 4, 6, 8, 12]
const DAILY_PRESETS = [1, 2, 3, 7]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

/**
 * Kumbh Park Parking Pass & Route Permit Flow
 * Signage-inspired booking interface with physical permit cards, duration markers, and boarding-pass ticket.
 */
export default function BookingSheet({ open, onClose, spot }) {
  return <BookingFlow key={open ? `open-${spot?.id}` : 'closed'} open={open} onClose={onClose} spot={spot} />
}

function BookingFlow({ open, onClose, spot }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [plan, setPlan] = useState('hour')
  const [hours, setHours] = useState(2)
  const [startsNow, setStartsNow] = useState(true)
  const [vehicleType, setVehicleType] = useState(() => spot?.vehicles?.[0] ?? 'car')
  const [plate, setPlate] = useState('MH 15 AB 1234')
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState(null)
  const [waitlisted, setWaitlisted] = useState(false)
  const [error, setError] = useState(null)

  const windows = useMemo(() => {
    const start = new Date()
    if (!startsNow) start.setHours(start.getHours() + 2)
    const end = new Date(start.getTime() + hours * 3600_000)
    return { startISO: start.toISOString(), endISO: end.toISOString() }
  }, [startsNow, hours])

  const laterStartISO = useMemo(() => {
    const start = new Date()
    start.setHours(start.getHours() + 2)
    return start.toISOString()
  }, [])

  const quote = useMemo(() => (spot ? quoteSummary(spot, { plan, hours }) : null), [spot, plan, hours])

  if (!spot) return null

  const steps = ['Duration & Permit', 'Vehicle Details', 'Permit Review & Pay', 'Digital Parking Ticket']
  const isFull = spot.availability === 'full'

  const confirm = async () => {
    if (plate.trim().length < 6) {
      setError('Enter a valid vehicle registration number')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createBooking({
        spotId: spot.id,
        plan,
        hours,
        startISO: windows.startISO,
        endISO: windows.endISO,
        vehicleType,
        plate: plate.trim().toUpperCase(),
        quote,
      })
      setBooking(created)
      setStep(3)
    } catch (err) {
      setError(err.friendlyMessage ?? err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const onWaitlist = async () => {
    setSubmitting(true)
    try {
      await joinWaitlist(spot.id, 'Rohit Kulkarni')
      setWaitlisted(true)
      toast.push({ tone: 'success', title: 'You are on the waitlist', message: 'We will text you if a bay frees up.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      height="tall"
      width={step === 3 ? 'wide' : 'default'}
      eyebrow={`KUMBH PARK PERMIT • SECTOR ${spot.zone?.short ?? 'NASHIK'}`}
      title={steps[Math.min(step, 3)]}
      subtitle={step < 3 ? spot.title : `Pass ID #${booking?.code || 'NPC-CONFIRMED'}`}
      footer={
        step < 3 ? (
          <div className="space-y-3">
            {step === 2 && (
              <div className="flex items-center justify-between rounded-xl bg-[#FAF7F2] p-3 border border-[#E2DDD3]">
                <span className="text-[#66706B] font-bold text-[13px] uppercase tracking-wider">
                  Total Tariff Payable
                </span>
                <span className="text-[22px] font-black text-[#E9A83A] font-mono">{money(quote.total)}</span>
              </div>
            )}
            <Button
              full
              size="lg"
              loading={submitting}
              disabled={isFull && step < 3}
              onClick={async () => {
                if (step === 2) await confirm()
                else setStep((s) => s + 1)
              }}
              className="bg-[#E9A83A] hover:bg-[#DC9B2E] text-[#17212B] font-black text-[15px] uppercase tracking-wide shadow-md transition-all active:scale-[0.98] py-4 cursor-pointer"
            >
              {step === 2
                ? `Confirm & Pay ${money(quote.total)} →`
                : 'Continue to Vehicle Registration →'}
            </Button>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="w-full py-1 text-[13px] font-bold text-[#6B6B6B] hover:text-[#17212B] transition-colors cursor-pointer"
              >
                ← Back to previous step
              </button>
            )}
          </div>
        ) : null
      }
    >
      {/* Step Indicator Progress Bar */}
      {step < 3 && (
        <div className="mb-5 flex gap-2">
          {steps.slice(0, 3).map((label, index) => (
            <div
              key={label}
              className={cn(
                'h-2 flex-1 rounded-full transition-all duration-300',
                index <= step ? 'bg-[#075B3D]' : 'bg-[#E8E4DA]',
              )}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-[#FBEAEA] border border-[#D96B5F]/30 p-3.5 text-[13px] text-[#D96B5F] font-semibold">
          <Icon name="alert" size={17} className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isFull && step < 3 && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-[#FFF8E7] border border-[#E6B84A]/40 p-3.5 text-[13px] text-amber-900 font-medium">
          <Icon name="info" size={17} className="mt-px shrink-0 text-[#B47C10]" />
          <span>
            This spot is currently full.{' '}
            <button type="button" onClick={onWaitlist} className="font-bold underline text-amber-950 cursor-pointer">
              {waitlisted ? 'On the waitlist' : 'Join the waitlist'}
            </button>{' '}
            and we will alert you instantly when a parking bay frees up.
          </span>
        </div>
      )}

      {/* =========================================================================
          STEP 1: DURATION & PERMIT CLASS SELECTION
      ========================================================================= */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Permit Class Tabs */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-2">
              Select Permit Class
            </span>
            <div className="flex gap-2.5">
              <SignagePlanTab
                active={plan === 'hour'}
                onClick={() => {
                  setPlan('hour')
                  setHours(2)
                }}
                label="Standard Hourly Pass"
                price={money(spot.priceHour)}
                unit="/hr"
              />
              <SignagePlanTab
                active={plan === 'day'}
                onClick={() => {
                  setPlan('day')
                  setHours(24)
                }}
                label="Full Pilgrimage Day Pass"
                price={money(spot.priceDay)}
                unit="/day"
              />
            </div>
          </div>

          {/* Selectable Duration Markers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                Select Parking Duration
              </span>
              <span className="text-[12px] font-extrabold text-[#075B3D]">
                {durationLabel(hours)} Reserved
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(plan === 'hour' ? HOURLY_PRESETS : DAILY_PRESETS).map((value) => {
                const realHours = plan === 'day' ? value * 24 : value
                const isSelected = hours === realHours

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setHours(realHours)}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all duration-150 cursor-pointer active:scale-95 font-mono',
                      isSelected
                        ? 'bg-[#075B3D] text-white border-2 border-white shadow-md ring-2 ring-[#075B3D]/30'
                        : 'bg-white text-[#17212B] border border-[#E8E4DA] hover:bg-[#FAF7F2]',
                    )}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[#E6B84A]" />
                    )}
                    <span className="text-[16px] font-black leading-tight">
                      {value}
                    </span>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', isSelected ? 'text-white/80' : 'text-[#6B6B6B]')}>
                      {plan === 'hour' ? 'Hour' : value > 1 ? 'Days' : 'Day'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Arrival Timing Wayfinding Controls */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-2">
              Arrival & Entry Window
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStartsNow(true)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer active:scale-98',
                  startsNow
                    ? 'border-[#075B3D] bg-[#E7F1EA] ring-2 ring-[#075B3D]/20'
                    : 'border-[#E8E4DA] bg-white hover:bg-[#FAF7F2]',
                )}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', startsNow ? 'bg-[#075B3D] text-white' : 'bg-[#E8E4DA] text-[#6B6B6B]')}>
                  <Icon name="bolt" size={18} />
                </span>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                    Immediate Access
                  </span>
                  <span className="text-[14px] font-black text-[#17212B]">
                    ARRIVAL: {time(windows.startISO)} TODAY
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStartsNow(false)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer active:scale-98',
                  !startsNow
                    ? 'border-[#075B3D] bg-[#E7F1EA] ring-2 ring-[#075B3D]/20'
                    : 'border-[#E8E4DA] bg-white hover:bg-[#FAF7F2]',
                )}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', !startsNow ? 'bg-[#075B3D] text-white' : 'bg-[#E8E4DA] text-[#6B6B6B]')}>
                  <Icon name="clock" size={18} />
                </span>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                    Deferred Access (+2h)
                  </span>
                  <span className="text-[14px] font-black text-[#17212B]">
                    ARRIVAL: {time(laterStartISO)}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Kumbh Park Parking Pass Estimate Permit Stub */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-[#17212B] bg-[#FAF7F2] p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-2 text-[10px] font-mono font-bold tracking-widest text-[#075B3D] uppercase">
              <span>KUMBH PARK PASS • ESTIMATE</span>
              <span>SECTOR {spot.zone?.short ?? 'NASHIK'}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#6B6B6B] block uppercase">
                  Parking Compound
                </span>
                <span className="text-[15px] font-black text-[#17212B] block">
                  {spot.title}
                </span>
                <span className="text-[12px] font-semibold text-[#6B6B6B]">
                  Arrival: {time(windows.startISO)} ({relativeDay(windows.startISO)})
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold text-[#6B6B6B] block uppercase">
                  Estimated Tariff
                </span>
                <span className="text-[22px] font-black text-[#075B3D] font-mono block">
                  {money(quote.total)}
                </span>
                <span className="text-[11px] font-bold text-[#0B7651]">
                  {durationLabel(hours)} Slot
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: VEHICLE REGISTRATION & COMPOUND CLEARANCE
      ========================================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-2">
              Select Vehicle Category
            </span>
            <div className="space-y-2.5">
              {VEHICLE_TYPES.filter((type) => spot.vehicles.includes(type.id)).map((type) => {
                const isSelected = vehicleType === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setVehicleType(type.id)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer active:scale-99',
                      isSelected
                        ? 'border-[#075B3D] bg-[#E7F1EA] ring-2 ring-[#075B3D]/20'
                        : 'border-[#E8E4DA] bg-white hover:bg-[#FAF7F2]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn('grid size-10 place-items-center rounded-xl', isSelected ? 'bg-[#075B3D] text-white' : 'bg-[#E8E4DA] text-[#17212B]')}>
                        <Icon name={VEHICLE_ICON[type.id]} size={20} />
                      </span>
                      <div>
                        <span className="text-[14px] font-black text-[#17212B] block">
                          {type.label}
                        </span>
                        <span className="text-[11px] text-[#6B6B6B]">
                          {type.id === '2w'
                            ? 'Motorcycle, Scooter, or Electric 2-Wheeler'
                            : type.id === 'car'
                              ? 'Hatchback, Sedan, or SUV'
                              : 'Tourist Bus, Tempo Traveller, or Minibus'}
                        </span>
                      </div>
                    </div>
                    <span className={cn('size-4 rounded-full border-2', isSelected ? 'border-[#075B3D] bg-[#075B3D]' : 'border-[#CBD5E1]')} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* High-Visibility Registration Plate Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B]">
              Vehicle Registration Number (For Gate Entry)
            </label>
            <div className="relative rounded-2xl border-2 border-[#17212B] bg-[#FFF8E7] p-2 focus-within:ring-2 focus-within:ring-[#075B3D]">
              <div className="flex items-center gap-2 px-2">
                <span className="rounded-md bg-[#17212B] px-2 py-1 text-[10px] font-black text-white uppercase font-mono">
                  IND
                </span>
                <input
                  value={plate}
                  onChange={(event) => setPlate(event.target.value.toUpperCase())}
                  placeholder="MH 15 AB 1234"
                  maxLength={14}
                  className="w-full bg-transparent text-[18px] font-black tracking-widest text-[#17212B] uppercase font-mono focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#6B6B6B]">
              The compound host verifies this registration number upon gate approach.
            </p>
          </div>

          {/* Compound Entry Rules */}
          <div className="rounded-2xl border border-[#E8E4DA] bg-[#FAF7F2] p-4 space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#17212B]">
              Compound Access Guidelines
            </p>
            <ul className="space-y-1.5">
              {spot.rules?.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-[12px] text-[#4A4A4A]">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[#075B3D]" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: PERMIT REVIEW & PAYMENT INVOICE
      ========================================================================= */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Header Card with Photo Thumbnail */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-[#E8E4DA] bg-white p-3.5 shadow-2xs">
            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#FAF7F2]">
              <Photo seed={spot.id} label={spot.title} ratio="aspect-square" rounded="rounded-xl" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-md bg-[#E7F1EA] px-2 py-0.5 text-[10px] font-black text-[#075B3D] uppercase tracking-wider">
                KUMBH PARK • SECTOR {spot.zone?.short ?? 'NASHIK'}
              </span>
              <h4 className="mt-0.5 text-[15px] font-black text-[#17212B] truncate">{spot.title}</h4>
              <p className="text-[11px] font-medium text-[#6B6B6B] truncate">{spot.address}</p>
            </div>
          </div>

          {/* Group 1: Trip & Pass Logistics */}
          <div className="rounded-2xl border border-[#E8E4DA] bg-white overflow-hidden shadow-2xs">
            <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E8E4DA] text-[11px] font-mono font-bold uppercase tracking-widest text-[#075B3D]">
              Permit Access Logistics
            </div>
            <div className="divide-y divide-[#E8E4DA]/70">
              <ReceiptRow
                label="Permit Window"
                value={`${relativeDay(windows.startISO)}, ${time(windows.startISO)} → ${time(windows.endISO)}`}
                bold
              />
              <ReceiptRow label="Reserved Duration" value={durationLabel(hours)} />
              <ReceiptRow
                label="Registered Vehicle"
                value={`${VEHICLE_TYPES.find((v) => v.id === vehicleType)?.label} • ${plate || '—'}`}
              />
            </div>
          </div>

          {/* Group 2: Itemized Tariff Breakdown */}
          <div className="rounded-2xl border border-[#E8E4DA] bg-white overflow-hidden shadow-2xs">
            <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E8E4DA] text-[11px] font-mono font-bold uppercase tracking-widest text-[#075B3D]">
              Tariff & Tax Invoice
            </div>
            <div className="divide-y divide-[#E8E4DA]/70">
              <ReceiptRow label={`Base Parking Tariff (${hoursLabel(hours)})`} value={money(quote.base)} />
              <ReceiptRow label="Platform & Security Guarantee" value={money(quote.serviceFee)} />
              <ReceiptRow label="GST (18%)" value={money(quote.gst)} />
              <div className="flex items-center justify-between bg-[#E7F1EA]/60 px-4 py-3 border-t border-[#075B3D]/20">
                <span className="text-[14px] font-black text-[#17212B] uppercase">
                  Total Tariff Due
                </span>
                <span className="text-[22px] font-black text-[#075B3D] font-mono">
                  {money(quote.total)}
                </span>
              </div>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] px-1 font-medium">
            <Icon name="shield" size={13} className="text-[#075B3D] shrink-0" />
            <span>Digital gate pass generated instantly upon confirmation. 100% money-back cancellation until check-in.</span>
          </p>
        </div>
      )}

      {/* =========================================================================
          STEP 4: CONFIRMED KUMBH PARK DIGITAL PARKING TICKET (PHYSICAL PASS STYLE)
      ========================================================================= */}
      {step === 3 && booking && (
        <div className="animate-[ticket-enter_0.35s_var(--ease-out-expo)] pb-4">
          <DigitalParkingTicket
            booking={booking}
            spot={spot}
            onClose={onClose}
            showActions={true}
          />
        </div>
      )}
    </Sheet>
  )
}

function SignagePlanTab({ active, onClick, label, price, unit }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-2xl border-2 p-3.5 text-left transition-all duration-150 active:scale-[0.99] cursor-pointer',
        active
          ? 'border-[#075B3D] bg-[#075B3D] text-white shadow-sm'
          : 'border-[#E8E4DA] bg-white text-[#17212B] hover:bg-[#FAF7F2]',
      )}
    >
      <span className={cn('block text-[11px] font-bold uppercase tracking-wider', active ? 'text-white/80' : 'text-[#6B6B6B]')}>
        {label}
      </span>
      <span className="mt-1 block text-[18px] font-black font-mono">
        {price}
        <span className={cn('text-[12px] font-normal ml-0.5', active ? 'text-white/80' : 'text-[#6B6B6B]')}>
          {unit}
        </span>
      </span>
    </button>
  )
}

function ReceiptRow({ label, value, bold = false }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-[13px] text-[#6B6B6B] font-medium">{label}</span>
      <span className={cn('text-right text-[13px] text-[#17212B]', bold ? 'font-black' : 'font-bold')}>
        {value}
      </span>
    </div>
  )
}
