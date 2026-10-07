/**
 * Single API surface for the whole app.
 *
 * Every screen imports from here and never from `mock/` or `http.js` directly,
 * so switching between local JSON and a live backend is a one-line env change
 * (VITE_USE_MOCK) rather than a refactor.
 *
 * Real-mode branches target the routes mounted under /api/v1 (see
 * server/README.md). The backend wraps responses as `{ data }`, or as
 * `{ data: [...], meta }` for paginated lists, so `payload()` unwraps one level
 * deeper than axios alone. Where the backend names or nests a field differently
 * from the mock fixtures, a `to*` adapter normalises it here so no screen has
 * to change.
 */
import { http, USE_MOCK } from './http'
import * as mock from './mock'

export const isMock = USE_MOCK

function qs(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '' || value === 'all') continue
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  const str = search.toString()
  return str ? `?${str}` : ''
}

/** `{ data: X }` (sendData) or `{ data: [...], meta }` (sendPage) -> X */
const payload = (response) => response?.data?.data

/** The mock API talks in `hour`/`day`; the backend enum is `hourly`/`daily`. */
const toPlan = (plan) => ({ hour: 'hourly', day: 'daily' })[plan] ?? plan
const fromPlan = (plan) => ({ hourly: 'hour', daily: 'day' })[plan] ?? plan

/** Screens read `zone.latlng`; zones come back as latitude/longitude. */
const toZone = (zone) =>
  zone ? { ...zone, latlng: [Number(zone.latitude), Number(zone.longitude)] } : zone

/**
 * Screens read `priceHour`/`priceDay`, `spotsLeft`, a numeric `capacity` and an
 * `vehicles` list. The API returns `pricePerHour`/`pricePerDay`, `bays.free`, a
 * `capacity` object keyed by vehicle type, and `isAccepting`.
 */
const toSpot = (spot) => {
  if (!spot) return spot
  const byType = spot.capacity ?? {}
  const vehicles = Object.keys(byType).filter((type) => Number(byType[type]) > 0)
  const capacity = Number(byType['2w'] ?? 0) + Number(byType.car ?? 0) + Number(byType.bus ?? 0)
  return {
    ...spot,
    latlng: [spot.lat, spot.lng],
    priceHour: spot.pricePerHour,
    priceDay: spot.pricePerDay,
    spotsLeft: spot.bays?.free ?? 0,
    capacity,
    vehicles,
    photoCount: (spot.photos ?? []).length,
    hostId: spot.host?.id ?? null,
    accepting: spot.isAccepting,
    from: spot.pricePerHour,
  }
}

/** Backend booking statuses are the +1 stage of the mock ones. */
const BOOKING_STATUS = {
  confirmed: 'upcoming',
  checked_in: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
}

/**
 * The backend nests spot/vehicle/pricing/host/user; screens read a flat
 * booking with `startISO`, `endISO`, `plate` and `amount`.
 */
const toBooking = (booking) => {
  if (!booking) return booking
  const spot = booking.spot ?? {}
  return {
    ...booking,
    status: BOOKING_STATUS[booking.status] ?? booking.status,
    plan: fromPlan(booking.plan),
    spotId: spot.id,
    hostId: booking.host?.id ?? null,
    zoneId: spot.zoneSlug,
    zoneName: spot.zone,
    title: spot.title,
    address: spot.address,
    latlng: spot.lat != null ? [spot.lat, spot.lng] : null,
    startISO: booking.start,
    endISO: booking.end,
    vehicleType: booking.vehicle?.type,
    plate: booking.vehicle?.number,
    amount: booking.pricing?.total,
    pin: booking.pinCode,
    checkedInISO: booking.checkIn?.checkedInAt ?? null,
    checkedOutISO: booking.checkOut?.checkedOutAt ?? null,
    createdISO: booking.createdAt ?? booking.created_at,
    isMine: true,
  }
}

/** Host listings carry verification state that the API exposes as `status`. */
const toHostListing = (spot) => ({
  ...toSpot(spot),
  verification: spot.status,
  published: spot.status === 'verified',
  accepting: spot.isAccepting,
  earnings: 0,
  cancelled: 0,
  todayBookings: 0,
})

/* ---------------------------------- zones --------------------------------- */
export function getZones() {
  if (USE_MOCK) return mock.getZones()
  return http.get('/zones').then((r) => (payload(r) ?? []).map(toZone))
}

// The backend has no ghat-points endpoint; these are static map markers, so
// they stay on the local fixture even in real mode.
export function getGhatPoints() {
  return mock.getGhatPoints()
}

/* --------------------------------- search --------------------------------- */

// The mock sorts with its own vocabulary; /spots/nearby takes a different enum.
const NEARBY_SORT = {
  recommended: 'distance',
  priceLow: 'price',
  priceHigh: 'price',
  distance: 'distance',
  rating: 'rating',
  availability: 'availability',
}

// Nearby search is coordinate-first (it has to be, it is a geo query), so a
// zone-only call still needs a point to measure distance from.
const NASHIK_CENTER = { lat: 19.9975, lng: 73.3118 }

export function searchSpots(params = {}) {
  if (USE_MOCK) return mock.searchSpots(params)
  const {
    origin,
    zone,
    vehicle,
    features,
    minPrice,
    maxPrice,
    instant,
    sort,
    startISO,
    endISO,
    start,
    end,
    page,
    pageSize,
  } = params
  const [lat, lng] = Array.isArray(origin) ? origin : []
  const query = qs({
    lat: lat ?? NASHIK_CENTER.lat,
    lng: lng ?? NASHIK_CENTER.lng,
    vehicle_type: vehicle,
    zone,
    min_price: minPrice,
    max_price: maxPrice,
    instant_book: instant ? true : undefined,
    features,
    start: start ?? startISO,
    end: end ?? endISO,
    sort: NEARBY_SORT[sort] ?? 'distance',
    page,
    pageSize,
  })
  return http.get(`/spots/nearby${query}`).then((r) => (payload(r) ?? []).map(toSpot))
}

export function getSpot(id) {
  if (USE_MOCK) return mock.getSpot(id)
  return http.get(`/spots/${id}`).then((r) => toSpot(payload(r)))
}

export function getSpotReviews(spotId) {
  if (USE_MOCK) return mock.getSpotReviews(spotId)
  return http.get(`/spots/${spotId}/reviews`).then((r) => payload(r) ?? [])
}

// Waitlists and saved listings have no backend endpoint yet; the UI keeps
// working off local state so the screens never 404.
export function joinWaitlist(spotId, name) {
  return mock.joinWaitlist(spotId, name)
}

export function setSaved(spotId, saved) {
  return mock.toggleSaved(spotId, saved)
}

/* -------------------------------- bookings -------------------------------- */
export function createBooking(booking) {
  if (USE_MOCK) return mock.createBooking(booking)
  const { startISO, endISO, plate, ...rest } = booking
  return http
    .post('/bookings', {
      ...rest,
      start: startISO,
      end: endISO,
      vehicleNumber: plate,
      plan: toPlan(booking.plan),
    })
    .then((r) => toBooking(payload(r)))
}

export function getMyBookings() {
  if (USE_MOCK) return mock.getMyBookings()
  return http.get('/bookings').then((r) => (payload(r) ?? []).map(toBooking))
}

export function cancelBooking(bookingId) {
  if (USE_MOCK) return mock.cancelBooking(bookingId)
  return http.post(`/bookings/${bookingId}/cancel`).then((r) => toBooking(payload(r)))
}

/* ---------------------------------- host ---------------------------------- */
export function getHostListings() {
  if (USE_MOCK) return mock.getHostListings()
  return http.get('/host/spots').then((r) => (payload(r) ?? []).map(toHostListing))
}

export function getHostBookings() {
  if (USE_MOCK) return mock.getHostBookings()
  return http.get('/host/bookings').then((r) => (payload(r) ?? []).map(toBooking))
}

export function getHostSummary() {
  if (USE_MOCK) return mock.getHostSummary()
  return http.get('/host/dashboard').then((r) => {
    const { stats = {}, spots: rawSpots = [], ...rest } = payload(r) ?? {}
    const spots = rawSpots.map(toHostListing)
    const total = spots.reduce((sum, s) => sum + Number(s.bays?.total ?? 0), 0)
    const free = spots.reduce((sum, s) => sum + Number(s.bays?.free ?? 0), 0)
    return {
      earningsToday: Number(stats.earnings_today ?? 0),
      activeBookings: Number(stats.checked_in_now ?? 0),
      upcomingBookings: Number(stats.bookings_today ?? 0),
      occupancy: total ? Math.round(((total - free) / total) * 100) : 0,
      // The backend has no waitlist concept yet.
      waitlist: 0,
      ...rest,
      stats,
      spots,
    }
  })
}

export function setAccepting(spotId, accepting) {
  if (USE_MOCK) return mock.setAccepting(spotId, accepting)
  return http
    .patch(`/host/spots/${spotId}/availability`, { isAccepting: accepting })
    .then((r) => ({ ...payload(r), spotId, accepting }))
}

/**
 * The backend requires the guest's 6-digit PIN (or a QR token) to check in —
 * there is no bare check-in. Callers that have one pass it as the 2nd argument.
 */
export function markCheckedIn(bookingId, pin) {
  if (USE_MOCK) return mock.markCheckedIn(bookingId)
  return http.post(`/bookings/${bookingId}/checkin`, { pin }).then((r) => payload(r))
}

export function markCheckedOut(bookingId) {
  if (USE_MOCK) return mock.markCheckedOut(bookingId)
  return http.post(`/bookings/${bookingId}/checkout`).then((r) => payload(r))
}

export function createHostListing(listing) {
  if (USE_MOCK) return mock.createHostListing(listing)
  const { latlng, capacity, vehicles, priceHour, priceDay, ...rest } = listing
  const types = vehicles?.length ? vehicles : ['car']
  // The form captures one total; the API wants a per-vehicle-type split.
  const base = Math.floor(Number(capacity ?? 0) / types.length)
  let remainder = Number(capacity ?? 0) - base * types.length
  const split = Object.fromEntries(
    ['2w', 'car', 'bus'].map((type) => {
      if (!types.includes(type)) return [type, 0]
      const count = base + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder -= 1
      return [type, count]
    }),
  )
  return http
    .post('/host/spots', {
      ...rest,
      lat: latlng?.[0],
      lng: latlng?.[1],
      capacity: split,
      pricePerHour: priceHour,
      pricePerDay: priceDay,
      submit: true,
    })
    .then((r) => toHostListing(payload(r)))
}

/* ---------------------------------- admin --------------------------------- */
export function getAdminOverview() {
  if (USE_MOCK) return mock.getAdminOverview()
  return Promise.all([
    http.get('/admin/analytics').then(payload),
    http.get('/admin/occupancy').then(payload),
  ]).then(([analytics, board = []]) => {
    const trend = analytics.trend ?? []
    const counts = board.reduce(
      (acc, row) => {
        const pct = row.occupancyPct ?? 0
        if (pct >= 90) acc.full += row.spots
        else if (pct >= 50) acc.filling += row.spots
        else acc.available += row.spots
        return acc
      },
      { available: 0, filling: 0, full: 0 },
    )
    const listed = counts.available + counts.filling + counts.full
    return {
      pendingVerifications: analytics.pending_submissions,
      liveBookings: analytics.active_now,
      openIssues: analytics.open_issues,
      grossToday: trend.length ? Number(trend[trend.length - 1].revenue) : 0,
      occupancy: {
        ...counts,
        rate: listed ? Math.round((counts.available / listed) * 100) : 0,
      },
      zoneLoad: board.map((row) => ({
        id: row.zone.id,
        name: row.zone.name,
        listings: row.spots,
        open: row.baysOpen,
        rate: row.baysTotal ? Math.round((row.baysOpen / row.baysTotal) * 100) : 0,
      })),
      analytics,
    }
  })
}

export function getVerifications() {
  if (USE_MOCK) return mock.getVerifications()
  // The endpoint is filtered by status and defaults to `pending`; the screen
  // expects every submission, so ask for all three and flatten.
  return Promise.all(
    ['pending', 'verified', 'rejected'].map((status) =>
      http.get(`/admin/spots/submissions${qs({ status, pageSize: 100 })}`).then((r) => payload(r) ?? []),
    ),
  ).then((pages) => pages.flat())
}

export function decideVerification(id, decision, note) {
  if (USE_MOCK) return mock.decideVerification(id, decision, note)
  return http
    .post(`/admin/spots/${id}/verify`, {
      decision: decision === 'verified' ? 'approved' : decision,
      notes: note,
    })
    .then((r) => payload(r))
}

export function getIssues() {
  if (USE_MOCK) return mock.getIssues()
  return http.get(`/admin/issues${qs({ status: 'all' })}`).then((r) => payload(r) ?? [])
}

export function updateIssue(id, patch) {
  if (USE_MOCK) return mock.updateIssue(id, patch)
  return http.post(`/admin/issues/${id}/resolve`, { resolution: patch.resolution }).then((r) => payload(r))
}

export function getOccupancy() {
  if (USE_MOCK) return mock.getOccupancy()
  return http.get('/admin/occupancy').then((r) => payload(r) ?? [])
}

/* ------------------------------- QR & Scanning ----------------------------- */

export function scanParking({ qrToken, locationCode, spotId }) {
  if (USE_MOCK) return mock.scanParking({ qrToken, locationCode, spotId })
  return http
    .post('/parking/scan', {
      qr_token: qrToken,
      location_code: locationCode,
      spot_id: spotId,
    })
    .then(payload)
}

export function payExtraAmount({ bookingId, razorpayPaymentId, razorpaySignature }) {
  if (USE_MOCK) return mock.payExtraAmount({ bookingId, razorpayPaymentId, razorpaySignature })
  return http
    .post('/parking/pay-extra', {
      booking_id: bookingId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    })
    .then(payload)
}

export function getSpotQr(spotId) {
  if (USE_MOCK) return mock.getSpotQr(spotId)
  return http.get(`/parking/${spotId}/qr`).then(payload)
}

export function regenerateSpotQr(spotId, reason) {
  if (USE_MOCK) return mock.regenerateSpotQr(spotId, reason)
  return http.post(`/parking/${spotId}/qr/regenerate`, { reason }).then(payload)
}

export function getPendingExtraBookings() {
  if (USE_MOCK) return mock.getPendingExtraBookings()
  return http.get('/parking/extra-pending').then((r) => payload(r) ?? [])
}

