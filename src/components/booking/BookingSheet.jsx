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
import QRCode from '@/components/ui/QRCode'
import StatusPill from '@/components/ui/StatusPill'
import { Field, Input, OptionTile } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'

const HOURLY_PRESETS = [1, 2, 4, 6, 8, 12]
const DAILY_PRESETS = [1, 2, 3, 7]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

/**
 * Booking flow inside a single sheet (spec §2 — bottom sheet everywhere).
 * Steps: duration → vehicle → summary → confirmed (QR + PIN).
 * The confirm button morphs to a checkmark rather than opening a full-screen modal.
 */
export default function BookingSheet({ open, onClose, spot }) {
  // Remounting on open gives the flow a clean slate every time, with no
  // reset-on-open effect.
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

  const steps = ['Duration', 'Vehicle', 'Summary', 'Confirmed']
  const isFull = spot.availability === 'full'

  const confirm = async () => {
    if (plate.trim().length < 6) {
      setError('Enter a valid vehicle number')
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
      eyebrow={step < 3 ? `Step ${step + 1} of 3` : 'Booking confirmed'}
      title={steps[Math.min(step, 3)]}
      subtitle={step < 3 ? spot.title : `Code ${booking?.code}`}
      footer={
        step < 3 ? (
          <div className="space-y-2.5">
            {step === 2 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">Total payable</span>
                <span className="text-[17px] font-bold">{money(quote.total)}</span>
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
            >
              {step === 2 ? `Pay ${money(quote.total)} & confirm` : 'Continue'}
            </Button>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="w-full py-1 text-[13px] font-semibold text-muted"
              >
                Back
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <Button
              full
              size="lg"
              onClick={() => {
                onClose?.()
                navigate('/bookings')
              }}
            >
              Done
            </Button>
            <button
              type="button"
              onClick={() => {
                onClose?.()
                navigate('/bookings')
              }}
              className="w-full py-1 text-[13px] font-semibold text-accent hover:underline"
            >
              View my bookings →
            </button>
          </div>
        )
      }
    >
      {step < 3 && (
        <div className="mb-4 flex gap-1">
          {steps.slice(0, 3).map((label, index) => (
            <div
              key={label}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                index <= step ? 'bg-accent' : 'bg-line',
              )}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-[12px] bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {error}
        </div>
      )}

      {isFull && step < 3 && (
        <div className="mb-3 flex items-start gap-2 rounded-[12px] bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
          <Icon name="info" size={16} className="mt-px shrink-0" />
          <span>
            This spot is full right now.{' '}
            <button type="button" onClick={onWaitlist} className="font-bold underline">
              {waitlisted ? 'On the waitlist' : 'Join the waitlist'}
            </button>{' '}
            and we will call you the moment a bay opens.
          </span>
        </div>
      )}

      {/* ------------------------------ step 1: duration ------------------------ */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="flex gap-2">
            <PlanTab active={plan === 'hour'} onClick={() => { setPlan('hour'); setHours(2) }} label="Hourly" price={money(spot.priceHour)} unit="/hr" />
            <PlanTab active={plan === 'day'} onClick={() => { setPlan('day'); setHours(24) }} label="Full day" price={money(spot.priceDay)} unit="/day" />
          </div>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">How long?</h3>
            <div className="flex flex-wrap gap-2">
              {(plan === 'hour' ? HOURLY_PRESETS : DAILY_PRESETS).map((value) => {
                const realHours = plan === 'day' ? value * 24 : value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setHours(realHours)}
                    className={cn(
                      'rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.97]',
                      hours === realHours ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-text',
                    )}
                  >
                    {plan === 'hour' ? `${value} hr` : `${value} day${value > 1 ? 's' : ''}`}
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-muted">
              <Icon name="clock" size={14} />
              Total time: <span className="font-semibold text-text">{durationLabel(hours)}</span>
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">Start time</h3>
            <div className="grid grid-cols-2 gap-2">
              <OptionTile
                active={startsNow}
                onClick={() => setStartsNow(true)}
                icon={<Icon name="bolt" size={16} />}
                title="Arrive now"
                subtitle={`${time(windows.startISO)} today`}
              />
              <OptionTile
                active={!startsNow}
                onClick={() => setStartsNow(false)}
                icon={<Icon name="clock" size={16} />}
                title="In 2 hours"
                subtitle={time(laterStartISO)}
              />
            </div>
          </section>

          <section className="rounded-[14px] bg-surface-sunken p-3.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Parking</span>
              <span className="font-semibold">
                {durationLabel(hours)} × {money(plan === 'hour' ? spot.priceHour : spot.priceDay / 24)}/hr
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[15px]">
              <span className="font-semibold">Estimated total</span>
              <span className="font-bold">{money(quote.total)}</span>
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------ step 2: vehicle ------------------------- */}
      {step === 1 && (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">What are you parking?</h3>
            <div className="space-y-2">
              {VEHICLE_TYPES.filter((type) => spot.vehicles.includes(type.id)).map((type) => (
                <OptionTile
                  key={type.id}
                  active={vehicleType === type.id}
                  onClick={() => setVehicleType(type.id)}
                  icon={<Icon name={VEHICLE_ICON[type.id]} size={17} />}
                  title={type.label}
                  subtitle={
                    type.id === '2w' ? 'Two-wheeler, scooter or bike' : type.id === 'car' ? 'Hatchback to SUV' : 'Tempo, minibus or tour bus'
                  }
                />
              ))}
            </div>
          </section>

          <Field label="Vehicle number" required error={error && /vehicle number/i.test(error)}>
            <Input
              value={plate}
              onChange={(event) => setPlate(event.target.value.toUpperCase())}
              placeholder="MH 15 AB 1234"
              maxLength={12}
              inputMode="text"
              className="uppercase tracking-wider"
            />
          </Field>

          <div className="rounded-[14px] border border-line p-3.5">
            <p className="text-[13px] font-semibold">Host gate rules</p>
            <ul className="mt-2 space-y-1.5">
              {spot.rules?.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-[13px] text-muted">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ------------------------------ step 3: summary ------------------------- */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-[14px] border border-line">
            <SummaryRow label="Spot" value={spot.title} />
            <SummaryRow label="Address" value={spot.address} />
            <SummaryRow label="Zone" value={spot.zone?.name} />
            <SummaryRow
              label="Window"
              value={`${relativeDay(windows.startISO)}, ${time(windows.startISO)} → ${time(windows.endISO)}`}
            />
            <SummaryRow label="Duration" value={durationLabel(hours)} />
            <SummaryRow
              label="Vehicle"
              value={`${VEHICLE_TYPES.find((v) => v.id === vehicleType)?.label} · ${plate || '—'}`}
            />
          </div>

          <div className="rounded-[14px] bg-surface-sunken p-3.5">
            <SummaryRow label={`Parking (${hoursLabel(hours)})`} value={money(quote.base)} />
            <SummaryRow label="Service fee" value={money(quote.serviceFee)} />
            <SummaryRow label="GST (18%)" value={money(quote.gst)} />
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <span className="text-[15px] font-semibold">Total</span>
              <span className="text-[19px] font-bold">{money(quote.total)}</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
              <Icon name="info" size={13} />
              Pay at the gate by UPI or cash. Free cancellation until check-in.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------ step 4: confirmed ----------------------- */}
      {step === 3 && booking && (
        <div className="space-y-4 text-center">
          <div className="flex flex-col items-center pt-2">
            <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success animate-[check-pop_0.45s_var(--ease-out-expo)]">
              <Icon name="check" size={28} strokeWidth={2.6} />
            </span>
            <h3 className="mt-3 text-[19px] font-bold">Spot booked</h3>
            <p className="mt-1 text-[13px] text-muted">
              {dateTime(booking.startISO)} · show this at the gate
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-[16px] bg-surface-sunken p-4">
            <QRCode value={qrPayload(booking)} size={176} />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Gate PIN</p>
              <p className="text-[30px] leading-none font-bold tracking-[0.3em] text-accent">{booking.pin}</p>
            </div>
            <StatusPill tone="success" label="Instant book · no host approval needed" />
          </div>

          <div className="rounded-[14px] border border-line p-3.5 text-left">
            <SummaryRow label="Booking code" value={booking.code} />
            <SummaryRow label="Vehicle" value={booking.plate} />
            <SummaryRow label="Window" value={`${time(booking.startISO)} → ${time(booking.endISO)}`} />
            <SummaryRow label="Paid at gate" value={money(booking.amount)} />
          </div>
        </div>
      )}
    </Sheet>
  )
}

function PlanTab({ active, onClick, label, price, unit }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-[14px] border p-3.5 text-left transition-all duration-200 active:scale-[0.99]',
        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
      )}
    >
      <span className="block text-[13px] font-semibold text-muted">{label}</span>
      <span className="mt-0.5 block text-[17px] font-bold">
        {price}
        <span className="text-[12px] font-medium text-muted">{unit}</span>
      </span>
    </button>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-3.5 py-2.5 last:border-b-0">
      <span className="shrink-0 text-[13px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold">{value}</span>
    </div>
  )
}
