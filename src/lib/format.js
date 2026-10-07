const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function money(value) {
  if (value == null) return '—'
  return inr.format(value)
}

/** 450 -> "₹450" ; always zero decimals, mela pricing is round numbers */
export function price(value, suffix) {
  if (value == null) return '—'
  return `${inr.format(value)}${suffix ?? ''}`
}

export function metres(m) {
  if (m == null) return '—'
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1)} km`
}

export function km(value) {
  if (value == null) return '—'
  return `${value.toFixed(1)} km`
}

export function rating(value) {
  if (value == null) return 'New'
  return Number(value).toFixed(1)
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const fullFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function time(iso) {
  if (!iso) return '—'
  return timeFmt.format(new Date(iso))
}

export function date(iso) {
  if (!iso) return '—'
  return dateFmt.format(new Date(iso))
}

export function dateTime(iso) {
  if (!iso) return '—'
  return fullFmt.format(new Date(iso))
}

export function hoursLabel(h) {
  if (h == null) return ''
  if (h < 1) return `${Math.round(h * 60)} min`
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  if (!mins) return `${whole} hr`
  if (!whole) return `${mins} min`
  return `${whole} hr ${mins} min`
}

/** "2 hrs" / "1 day 4 hrs" for booking summaries */
export function durationLabel(hours) {
  const h = Math.max(0, Math.round(hours * 100) / 100)
  if (h < 1) return `${Math.round(h * 60)} min`
  const days = Math.floor(h / 24)
  const rem = h - days * 24
  if (!days) return hoursLabel(h)
  if (!rem) return `${days} day${days > 1 ? 's' : ''}`
  return `${days} day${days > 1 ? 's' : ''} ${hoursLabel(rem)}`
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many ?? `${one}s`}`
}

export function relativeDay(iso) {
  if (!iso) return '—'
  const target = new Date(iso)
  const today = new Date()
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(target) - startOf(today)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days < 7) return `In ${days} days`
  return dateFmt.format(target)
}
