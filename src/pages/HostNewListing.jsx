import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createHostListing, getZones } from '@/api'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { FEATURES, SURFACES, VEHICLE_TYPES } from '@/api/mock/spots'
import { useAsync } from '@/hooks/useAsync'
import { PageShell, PageHeader } from '@/components/layout/PageShell'
import KumbhMap from '@/components/map/KumbhMap'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Photo from '@/components/ui/Photo'
import { photoUri } from '@/lib/photo'
import { Field, Input, OptionTile, Select, Textarea } from '@/components/ui/Field'
import { StepBar } from '@/components/ui/Feedback'
import { SegmentedTabs } from '@/components/ui/Chip'
import { useToast } from '@/components/ui/Toast'
import { useApp } from '@/context/AppContext'

const STEPS = [
  { id: 'location', label: 'Location' },
  { id: 'details', label: 'Details' },
  { id: 'photos', label: 'Photos' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'availability', label: 'Hours' },
  { id: 'review', label: 'Review' },
]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }
const FEATURE_ICON = {
  covered: 'home',
  gate: 'lock',
  cctv: 'video',
  floodlight: 'bulb',
  caretaker: 'user',
  water: 'droplet',
  ev: 'bolt',
  wide: 'wide',
}

const TIME_WINDOWS = [
  { id: 'morning', label: 'Morning snan', from: '05:00', to: '11:00' },
  { id: 'day', label: 'Day darshan', from: '11:00', to: '17:00' },
  { id: 'aarti', label: 'Evening aarti', from: '17:00', to: '22:00' },
  { id: 'night', label: 'Overnight', from: '22:00', to: '05:00' },
]

/**
 * Multi-step host form. Steps slide horizontally instead of the sheet
 * re-opening (spec §4), with a single primary CTA pinned to the bottom.
 */
export default function HostNewListing() {
  const navigate = useNavigate()
  const toast = useToast()
  const { host } = useApp()
  const { data: zones } = useAsync(() => getZones(), [])

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  const [form, setForm] = useState({
    zoneId: 'ramkund',
    address: '',
    landmark: '',
    latlng: [19.9525, 73.3342],
    title: '',
    description: '',
    vehicles: ['2w', 'car'],
    capacity: 8,
    surface: 'Cement',
    clearanceM: 2.5,
    features: ['gate', 'floodlight'],
    photos: 3,
    priceHour: 30,
    priceDay: 200,
    windows: ['morning', 'day', 'aarti'],
    note: '',
  })

  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const goTo = (next) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const errors = useMemo(() => validate(step, form), [step, form])
  const zone = zones?.find((z) => z.id === form.zoneId)
  const pinFocus = useMemo(
    () => ({ latlng: form.latlng, zoom: 17 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.latlng[0], form.latlng[1]],
  )

  const submit = async () => {
    setSubmitting(true)
    try {
      const result = await createHostListing({
        ...form,
        title: form.title || `${form.capacity}-spot parking near ${zone?.short ?? 'the ghat'}`,
        hostName: host.name,
        phone: host.phone,
      })
      setSubmitted(result)
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not submit', message: err.friendlyMessage ?? err.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <PageHeader title="Submitted" backTo="/host" />
        <div className="mx-auto max-w-md px-4 pt-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success animate-[check-pop_0.45s_var(--ease-out-expo)]">
            <Icon name="check" size={30} strokeWidth={2.6} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold">Sent for verification</h1>
          <p className="mt-2 text-[14px] text-muted">
            Our team checks your documents and photographs the plot. Listings usually go live within 4 hours during
            the mela.
          </p>
          <div className="mt-5 rounded-[var(--radius-card)] bg-surface p-4 text-left card-shadow">
            <Row label="Submission" value={submitted.id} />
            <Row label="Zone" value={submitted.zoneName} />
            <Row label="Capacity" value={`${submitted.capacity} vehicles`} />
            <Row label="Rate" value={`${money(submitted.priceHour)}/hr`} />
          </div>
          <Button full size="lg" className="mt-5" onClick={() => navigate('/host')}>
            Back to host dashboard
          </Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="List your parking" subtitle={`Step ${step + 1} of ${STEPS.length}`} backTo="/host" />

      <div className="sticky top-[52px] z-[500] border-b border-line bg-bg/94 px-4 py-3 backdrop-blur-sm">
        <StepBar steps={STEPS} current={step} />
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-5 pb-32">
        <div
          key={step}
          className={cn(direction > 0 ? 'animate-[step-in_0.28s_var(--ease-out-expo)]' : 'animate-[step-back_0.28s_var(--ease-out-expo)]')}
        >
          {/* ------------------------------ step 1: location --------------------- */}
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Which zone is the spot in?" required>
                <Select value={form.zoneId} onChange={(event) => set({ zoneId: event.target.value })}>
                  {(zones ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Full address" required error={errors.address} hint="Pilgrims see this after booking only.">
                <Input
                  value={form.address}
                  onChange={(event) => set({ address: event.target.value })}
                  placeholder="House no, street, landmark"
                />
              </Field>

              <Field label="Nearest landmark" hint="Helps guests find the gate during the rush.">
                <Input
                  value={form.landmark}
                  onChange={(event) => set({ landmark: event.target.value })}
                  placeholder="e.g. opposite Sagar Petrol Pump"
                />
              </Field>

              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Pin the exact gate</p>
                <p className="mb-2 text-[12px] text-muted">
                  Drag the map and tap to drop your pin. This is the location guests navigate to.
                </p>
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
                  <div className="relative h-64">
                    <KumbhMap
                      spots={[]}
                      center={form.latlng}
                      focus={pinFocus}
                      onMapClick={(latlng) => set({ latlng })}
                      showZoom={false}
                    />
                    <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-accent">
                      <Icon name="pin" size={30} filled />
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  {form.latlng[0].toFixed(4)}, {form.latlng[1].toFixed(4)} · {zone?.name}
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------ step 2: details ---------------------- */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Listing title" required error={errors.title} hint="Say what it is and where it is.">
                <Input
                  value={form.title}
                  onChange={(event) => set({ title: event.target.value })}
                  placeholder="e.g. Driveway behind Sagar Petrol Pump"
                />
              </Field>

              <Field label="What can guests expect?" hint="Mention surface, shade and how tight the entry is.">
                <Textarea
                  value={form.description}
                  onChange={(event) => set({ description: event.target.value })}
                  placeholder="Level covered driveway, 6 minutes walk to Ramkund main road…"
                />
              </Field>

              <Field label="Vehicle types allowed" required>
                <div className="space-y-2">
                  {VEHICLE_TYPES.map((type) => {
                    const active = form.vehicles.includes(type.id)
                    return (
                      <OptionTile
                        key={type.id}
                        active={active}
                        onClick={() =>
                          set({
                            vehicles: active
                              ? form.vehicles.filter((v) => v !== type.id)
                              : [...form.vehicles, type.id],
                          })
                        }
                        icon={<Icon name={VEHICLE_ICON[type.id]} size={17} />}
                        title={type.label}
                      />
                    )
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Vehicle capacity" required>
                  <Input
                    type="number"
                    min={1}
                    max={80}
                    value={form.capacity}
                    onChange={(event) => set({ capacity: Number(event.target.value) || 1 })}
                  />
                </Field>
                <Field label="Height clearance">
                  <Select value={form.clearanceM} onChange={(event) => set({ clearanceM: Number(event.target.value) })}>
                    {[2, 2.4, 3, 4, 5, 6].map((value) => (
                      <option key={value} value={value}>
                        {value} m
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Surface">
                <Select value={form.surface} onChange={(event) => set({ surface: event.target.value })}>
                  {SURFACES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>

              <div>
                <p className="mb-2 text-[13px] font-semibold">Amenities</p>
                <div className="grid grid-cols-2 gap-2">
                  {FEATURES.map((feature) => {
                    const active = form.features.includes(feature.id)
                    return (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() =>
                          set({
                            features: active
                              ? form.features.filter((f) => f !== feature.id)
                              : [...form.features, feature.id],
                          })
                        }
                        className={cn(
                          'flex items-center gap-2 rounded-[12px] border p-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]',
                          active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-text',
                        )}
                      >
                        <Icon name={FEATURE_ICON[feature.id]} size={15} />
                        {feature.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------ step 3: photos ----------------------- */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold">Photos</p>
                <p className="mt-1 text-[12px] text-muted">
                  Mela listings with 4+ photos get booked 2× more often. Add the gate, the surface and one wide shot.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="relative">
                    <Photo
                      src={index < form.photos ? photoUri(`${form.zoneId}-photo-${index}`, 'YOUR SPOT') : undefined}
                      seed={`${form.zoneId}-photo-${index}`}
                      label="YOUR SPOT"
                      ratio="aspect-square"
                      rounded="rounded-[12px]"
                      className={index < form.photos ? '' : 'opacity-40'}
                    />
                    {index < form.photos ? (
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => set({ photos: form.photos - 1 })}
                        className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/50 text-white"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set({ photos: Math.min(6, form.photos + 1) })}
                  className="grid aspect-square place-items-center rounded-[12px] border-2 border-dashed border-line text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <span className="flex flex-col items-center gap-1">
                    <Icon name="camera" size={20} />
                    <span className="text-[11px] font-semibold">{form.photos}/6</span>
                  </span>
                </button>
              </div>

              <div className="rounded-[14px] bg-surface-sunken p-3.5">
                <p className="flex items-center gap-2 text-[13px] font-semibold">
                  <Icon name="info" size={15} className="text-muted" />
                  Photo tips
                </p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
                  <li>· Shoot the gate from the road, not from inside the plot.</li>
                  <li>· Include a photo of the parking surface so guests know what they get.</li>
                  <li>· Avoid shots with other vehicles' number plates visible.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ------------------------------ step 4: pricing ---------------------- */}
          {step === 3 && (
            <div className="space-y-4">
              <Field label="Plan" required>
                <SegmentedTabs
                  tabs={[
                    { id: 'both', label: 'Hourly + daily' },
                    { id: 'hour', label: 'Hourly only' },
                    { id: 'day', label: 'Daily only' },
                  ]}
                  value="both"
                  onChange={() => {}}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price per hour" required>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={form.priceHour}
                    onChange={(event) => set({ priceHour: Number(event.target.value) || 0 })}
                  />
                </Field>
                <Field label="Price per day" required>
                  <Input
                    type="number"
                    min={50}
                    step={10}
                    value={form.priceDay}
                    onChange={(event) => set({ priceDay: Number(event.target.value) || 0 })}
                  />
                </Field>
              </div>

              <div className="rounded-[var(--radius-card)] bg-surface p-4 card-shadow">
                <p className="text-[13px] font-semibold">Earnings preview</p>
                <div className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted">If fully booked for 8 hours</span>
                    <span className="font-semibold">{money(form.priceHour * 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">If fully booked for 3 days</span>
                    <span className="font-semibold">{money(form.priceDay * 3)}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold">
                    <span>Your cut per day (94%)</span>
                    <span>{money(Math.round(form.priceDay * 0.94))}</span>
                  </div>
                </div>
                <p className="mt-3 text-[12px] text-muted">
                  Comparable spots in {zone?.name ?? 'this zone'} go for {money(form.priceHour - 10)}–
                  {money(form.priceHour + 20)}/hr.
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------- step 5: availability -------------------- */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold">When can guests park?</p>
                <p className="mt-1 text-[12px] text-muted">Pick the windows you can keep the gate open for.</p>
              </div>

              <div className="space-y-2">
                {TIME_WINDOWS.map((window) => {
                  const active = form.windows.includes(window.id)
                  return (
                    <button
                      key={window.id}
                      type="button"
                      onClick={() =>
                        set({
                          windows: active
                            ? form.windows.filter((w) => w !== window.id)
                            : [...form.windows, window.id],
                        })
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left transition-all active:scale-[0.99]',
                        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-full',
                          active ? 'bg-accent text-white' : 'bg-surface-sunken text-muted',
                        )}
                      >
                        <Icon name={window.id === 'night' ? 'moon' : 'sun'} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold">{window.label}</span>
                        <span className="mt-0.5 block text-[12px] text-muted">
                          {window.from} – {window.to}
                        </span>
                      </span>
                      {active && <Icon name="checkCircle" size={18} className="shrink-0 text-accent" />}
                    </button>
                  )
                })}
              </div>

              <Field label="Anything the team should know?" hint="Gate codes, caretaker number, access restrictions.">
                <Textarea
                  value={form.note}
                  onChange={(event) => set({ note: event.target.value })}
                  placeholder="Gate is unlocked from 04:30, caretaker stays on site."
                />
              </Field>
            </div>
          )}

          {/* ------------------------------ step 6: review ----------------------- */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface card-shadow">
                <Photo seed={`${form.zoneId}-cover`} label={zone?.short} ratio="aspect-[16/9]" rounded="rounded-none" />
                <div className="p-4">
                  <h2 className="text-[17px] font-bold">{form.title || `${form.capacity}-spot parking`}</h2>
                  <p className="mt-1 text-[13px] text-muted">
                    {form.address || 'Address not set'} · {zone?.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.vehicles.map((vehicle) => (
                      <span
                        key={vehicle}
                        className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] font-semibold"
                      >
                        <Icon name={VEHICLE_ICON[vehicle]} size={13} />
                        {VEHICLE_TYPES.find((v) => v.id === vehicle)?.label}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] font-semibold">
                      <Icon name="car" size={13} />
                      {form.capacity} spots
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] bg-surface p-4 card-shadow">
                <Row label="Rate" value={`${money(form.priceHour)}/hr · ${money(form.priceDay)}/day`} />
                <Row label="Surface" value={form.surface} />
                <Row label="Clearance" value={`${form.clearanceM} m`} />
                <Row
                  label="Windows"
                  value={form.windows.map((w) => TIME_WINDOWS.find((t) => t.id === w)?.label).join(', ')}
                />
                <Row label="Amenities" value={`${form.features.length} selected`} />
                <Row label="Photos" value={`${form.photos} uploaded`} />
              </div>

              <div className="rounded-[14px] bg-surface-sunken p-3.5">
                <p className="text-[13px] font-semibold">What happens next</p>
                <ol className="mt-2 space-y-1.5 text-[13px] text-muted">
                  <li>1. We verify your ID and property/lease proof.</li>
                  <li>2. Our team photographs the plot to match your listing.</li>
                  <li>3. Listing goes live and you start getting booking requests.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* single primary CTA */}
      <div className="fixed inset-x-0 bottom-0 z-[750] border-t border-line bg-surface/97 px-4 pt-3 pb-[calc(0.75rem+max(0.75rem,env(safe-area-inset-bottom)))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl gap-3">
          {step > 0 && (
            <Button variant="outline" size="lg" onClick={() => goTo(step - 1)} className="shrink-0 px-6">
              Back
            </Button>
          )}
          <Button
            full
            size="lg"
            loading={submitting}
            disabled={Object.keys(errors).length > 0}
            onClick={() => (step === STEPS.length - 1 ? submit() : goTo(step + 1))}
          >
            {step === STEPS.length - 1 ? 'Submit for verification' : 'Continue'}
          </Button>
        </div>
      </div>
    </PageShell>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <span className="shrink-0 text-[13px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold">{value}</span>
    </div>
  )
}

function validate(step, form) {
  if (step === 0) {
    const errors = {}
    if (!form.address.trim()) errors.address = 'Add the full address so guests can reach the gate'
    return errors
  }
  if (step === 1) {
    const errors = {}
    if (!form.title.trim()) errors.title = 'Give the listing a clear title'
    if (!form.vehicles.length) errors.vehicles = 'Select at least one vehicle type'
    return errors
  }
  return {}
}
