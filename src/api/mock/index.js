import { ghatPoints, zones, zoneById } from './zones'
import { featureLabel, reviews, spots, spotById, vehicleLabel } from './spots'
import state from './store'
import { haversineKm } from '@/lib/geo'
import { bookingCode, checkInPin, uid } from '@/lib/id'

const clone = (v) => JSON.parse(JSON.stringify(v))

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const jitter = (base) => base + Math.random() * 220

/* ------------------------------------------------------------------ *
 * Live availability
 * ------------------------------------------------------------------ */

function availabilityOf(spotId, spotsLeft) {
  const spot = spotById(spotId)
  if (!spot) return 'full'
  if (spotsLeft <= 0) return 'full'
  if (spotsLeft / spot.capacity <= 0.34) return 'filling'
  return 'available'
}

export function withLive(spot) {
  const spotsLeft = state.occupancy[spot.id] ?? spot.spotsLeft
  const availability = availabilityOf(spot.id, spotsLeft)
  return { ...spot, spotsLeft, availability, status: availability }
}

const liveSpots = () => spots.map(withLive)

/* ------------------------------------------------------------------ *
 * Zones
 * ------------------------------------------------------------------ */

export async function getZones() {
  await wait(jitter(120))
  return clone(zones)
}

export async function getGhatPoints() {
  await wait(60)
  return clone(ghatPoints)
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

const SORTERS = {
  recommended: (a, b) => b.rating * 20 - b.distanceKm - (a.rating * 20 - a.distanceKm),
  priceLow: (a, b) => a.from - b.from,
  priceHigh: (a, b) => b.from - a.from,
  distance: (a, b) => a.distanceKm - b.distanceKm,
  rating: (a, b) => b.rating - a.rating,
}

function matchesQuery(spot, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  const haystack = [
    spot.title,
    spot.address,
    spot.zone?.name,
    spot.zone?.short,
    spot.ghat?.name,
    ...spot.features.map(featureLabel),
    ...spot.vehicles.map(vehicleLabel),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export async function searchSpots(params = {}) {
  await wait(jitter(520))

  const {
    zone = 'all',
    q = '',
    vehicle = 'all',
    features = [],
    maxPrice = null,
    plan = 'hour',
    instant = false,
    onlyAvailable = false,
    openNow = true,
    sort = 'recommended',
    origin = null,
  } = params

  const originPoint = origin ?? (zone !== 'all' ? zoneById(zone)?.latlng : null)

  let results = liveSpots().filter((spot) => {
    if (zone !== 'all' && spot.zoneId !== zone) return false
    if (vehicle !== 'all' && !spot.vehicles.includes(vehicle)) return false
    if (instant && !spot.instantBook) return false
    if (onlyAvailable && spot.availability === 'full') return false
    if (maxPrice != null) {
      const from = plan === 'day' ? spot.priceDay : spot.priceHour
      if (from > maxPrice) return false
    }
    if (features.length && !features.every((f) => spot.features.includes(f))) return false
    if (openNow) {
      const hour = new Date().getHours()
      const [fromH] = spot.checkInFrom.split(':').map(Number)
      const [toH] = spot.checkOutBy.split(':').map(Number)
      if (hour < fromH || hour >= toH) return false
    }
    return matchesQuery(spot, q)
  })

  results = results.map((spot) => {
    const distanceKm = originPoint ? haversineKm(originPoint, spot.latlng) : 0
    return {
      ...spot,
      distanceKm,
      from: plan === 'day' ? spot.priceDay : spot.priceHour,
      plan,
      host: null,
    }
  })

  results.sort(SORTERS[sort] ?? SORTERS.recommended)
  return clone(results)
}

export async function getSpot(id) {
  await wait(jitter(280))
  const spot = spotById(id)
  if (!spot) return null
  return {
    ...clone(withLive(spot)),
    waitlist: state.waitlist.filter((w) => w.spotId === id).length,
  }
}

export async function getSpotReviews(spotId) {
  await wait(200)
  return clone(reviews.filter((r) => r.spotId === spotId))
}

export async function joinWaitlist(spotId, name) {
  await wait(420)
  const entry = { id: uid('w'), spotId, name, createdISO: new Date().toISOString() }
  state.waitlist.push(entry)
  return clone(entry)
}

export async function toggleSaved(spotId, saved) {
  await wait(160)
  void spotId
  return { spotId, saved }
}

/* ------------------------------------------------------------------ *
 * Booking
 * ------------------------------------------------------------------ */

export async function createBooking(payload) {
  await wait(jitter(760))

  const spot = spotById(payload.spotId)
  if (!spot) throw new Error('Unknown listing')
  const left = state.occupancy[spot.id] ?? spot.spotsLeft
  if (left <= 0) throw new Error('This listing just filled up. Try a waitlist spot instead.')

  const booking = {
    id: uid('b'),
    code: bookingCode(),
    spotId: spot.id,
    hostId: spot.hostId,
    zoneId: spot.zoneId,
    zoneName: spot.zone.name,
    title: spot.title,
    address: spot.address,
    latlng: spot.latlng,
    photo: Math.floor(Math.random() * (spot.photoCount || 4)),
    plan: payload.plan,
    hours: payload.hours,
    startISO: payload.startISO,
    endISO: payload.endISO,
    vehicleType: payload.vehicleType,
    plate: payload.plate,
    pin: checkInPin(),
    status: payload.startISO && new Date(payload.startISO) <= new Date() ? 'active' : 'upcoming',
    checkedInISO: null,
    checkedOutISO: null,
    amount: payload.quote?.total ?? 0,
    createdISO: new Date().toISOString(),
    isMine: true,
  }

  state.bookings.unshift(booking)
  state.occupancy[spot.id] = left - 1
  return clone(booking)
}

export async function getMyBookings() {
  await wait(jitter(420))
  return clone(state.bookings.filter((b) => b.isMine).sort(sortByRecency))
}

export async function cancelBooking(bookingId) {
  await wait(jitter(560))
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking) throw new Error('Booking not found')
  if (booking.status === 'completed') throw new Error('Completed bookings cannot be cancelled')
  booking.status = 'cancelled'
  booking.cancelReason = 'Cancelled by you'
  booking.cancelISO = new Date().toISOString()
  state.occupancy[booking.spotId] = (state.occupancy[booking.spotId] ?? 0) + 1
  return clone(booking)
}

function sortByRecency(a, b) {
  return new Date(b.startISO) - new Date(a.startISO)
}

/* ------------------------------------------------------------------ *
 * Host
 * ------------------------------------------------------------------ */

function listingFor(spot) {
  const meta = state.hostListings.find((l) => l.spotId === spot.id) ?? {
    verification: 'pending',
    published: false,
    accepting: true,
    earnings: 0,
    cancelled: 0,
  }
  return {
    ...withLive(spot),
    ...meta,
    todayBookings: state.bookings.filter(
      (b) => b.spotId === spot.id && b.status !== 'cancelled' && b.endISO > new Date().toISOString(),
    ).length,
  }
}

export async function getHostListings() {
  await wait(jitter(420))
  return clone(state.hostListings.map((meta) => listingFor(spotById(meta.spotId))))
}

export async function getHostBookings() {
  await wait(jitter(400))
  const mySpotIds = state.hostListings.map((l) => l.spotId)
  return clone(
    state.bookings.filter((b) => mySpotIds.includes(b.spotId)).sort((a, b) => {
      const rank = { active: 0, upcoming: 1, completed: 2, cancelled: 3 }
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
      return new Date(b.startISO) - new Date(a.startISO)
    }),
  )
}

export async function setAccepting(spotId, accepting) {
  await wait(200)
  const meta = state.hostListings.find((l) => l.spotId === spotId)
  if (meta) meta.accepting = accepting
  return { spotId, accepting }
}

export async function markCheckedIn(bookingId) {
  await wait(380)
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking) throw new Error('Booking not found')
  booking.status = 'active'
  booking.checkedInISO = new Date().toISOString()
  return clone(booking)
}

export async function markCheckedOut(bookingId) {
  await wait(380)
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking) throw new Error('Booking not found')
  booking.status = 'completed'
  booking.checkedOutISO = new Date().toISOString()
  return clone(booking)
}

export async function createHostListing(payload) {
  await wait(jitter(820))
  const zone = zoneById(payload.zoneId)
  const submission = {
    id: uid('sub'),
    hostName: payload.hostName,
    phone: payload.phone,
    title: payload.title,
    zoneId: payload.zoneId,
    zoneName: zone?.name ?? 'Nashik',
    address: payload.address,
    latlng: payload.latlng,
    vehicles: payload.vehicles,
    capacity: payload.capacity,
    priceHour: payload.priceHour,
    priceDay: payload.priceDay,
    features: payload.features,
    documents: ['Aadhaar (masked)', 'Property / lease proof'],
    submittedISO: new Date().toISOString(),
    status: 'pending',
    note: payload.note,
  }
  state.submissions.unshift(submission)
  return clone(submission)
}

export async function getHostSummary() {
  await wait(jitter(300))
  const mySpotIds = state.hostListings.map((l) => l.spotId)
  const mine = state.bookings.filter((b) => mySpotIds.includes(b.spotId))
  const today = new Date().toISOString().slice(0, 10)
  const gross = mine
    .filter((b) => b.status !== 'cancelled' && (b.checkedInISO ?? b.createdISO).slice(0, 10) === today)
    .reduce((sum, b) => sum + Math.round(b.amount * 0.94), 0)
  return {
    earningsToday: gross,
    activeBookings: mine.filter((b) => b.status === 'active').length,
    upcomingBookings: mine.filter((b) => b.status === 'upcoming').length,
    occupancy: state.hostListings.length
      ? Math.round(
          (state.hostListings.reduce(
            (sum, l) => {
              const spot = spotById(l.spotId)
              return sum + (spot ? 1 - (state.occupancy[l.spotId] ?? 0) / spot.capacity : 0)
            },
            0,
          ) /
            state.hostListings.length) *
            100,
        )
      : 0,
    waitlist: state.waitlist.filter((w) => mySpotIds.includes(w.spotId)).length,
  }
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

export async function getAdminOverview() {
  await wait(jitter(380))
  const live = liveSpots()
  const open = live.filter((s) => s.availability === 'available')
  const filling = live.filter((s) => s.availability === 'filling')
  const full = live.filter((s) => s.availability === 'full')
  return {
    pendingVerifications: state.submissions.filter((s) => s.status === 'pending').length,
    liveBookings: state.bookings.filter((b) => b.status === 'active').length,
    openIssues: state.issues.filter((i) => i.status === 'open').length,
    grossToday: state.bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.amount, 0),
    occupancy: {
      available: open.length,
      filling: filling.length,
      full: full.length,
      rate: live.length ? Math.round((open.length / live.length) * 100) : 0,
    },
    zoneLoad: zones.map((z) => {
      const inZone = live.filter((s) => s.zoneId === z.id)
      const openCount = inZone.filter((s) => s.availability === 'available').length
      return {
        id: z.id,
        name: z.name,
        listings: inZone.length,
        open: openCount,
        rate: inZone.length ? Math.round((openCount / inZone.length) * 100) : 0,
      }
    }),
  }
}

export async function getVerifications() {
  await wait(jitter(340))
  return clone(state.submissions)
}

export async function decideVerification(id, decision, note) {
  await wait(jitter(520))
  const submission = state.submissions.find((s) => s.id === id)
  if (!submission) throw new Error('Submission not found')
  submission.status = decision
  submission.decisionISO = new Date().toISOString()
  submission.decisionNote = note ?? null
  return clone(submission)
}

export async function getIssues() {
  await wait(jitter(300))
  return clone(state.issues)
}

export async function updateIssue(id, patch) {
  await wait(340)
  const issue = state.issues.find((i) => i.id === id)
  if (!issue) throw new Error('Issue not found')
  Object.assign(issue, patch, { updatedISO: new Date().toISOString() })
  return clone(issue)
}

export async function getOccupancy() {
  await wait(jitter(300))
  return clone(liveSpots())
}

/* ------------------------------------------------------------------ *
 * QR Scan, Check-in / Check-out & Extra Payments
 * ------------------------------------------------------------------ */

export async function scanParking({ qrToken, locationCode, spotId }) {
  await wait(jitter(350))

  let parkingId = spotId

  if (qrToken && qrToken.startsWith('pk_')) {
    try {
      const raw = qrToken.slice(3).split('.')[0]
      const json = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))
      parkingId = json.parking_id
    } catch {
      // Fallback
    }
  }

  if (!parkingId && locationCode) {
    const matched = spots.find(
      (s) => s.id === locationCode || s.title.toLowerCase().includes(locationCode.toLowerCase()),
    )
    if (matched) parkingId = matched.id
  }

  if (!parkingId) {
    parkingId = spots[0]?.id
  }

  const spot = spotById(parkingId) || spots[0]
  const now = new Date()

  // Find candidate booking for pilgrim in mock state
  const activeBooking = state.bookings.find(
    (b) => (b.spotId === spot.id || !b.checkedOutISO) && b.status === 'active' && b.isMine,
  )

  if (activeBooking) {
    // CHECK-OUT FLOW
    const scheduledEnd = new Date(activeBooking.endISO)
    let extraHours = 0
    let extraDurationMinutes = 0
    let extraAmount = 0
    let newStatus = 'completed'
    let bookingStatus = 'COMPLETED'
    let paymentStatus = 'COMPLETED'
    let razorpayOrder = null

    if (now.getTime() > scheduledEnd.getTime()) {
      const extraMillis = now.getTime() - scheduledEnd.getTime()
      extraDurationMinutes = Math.round(extraMillis / (60 * 1000))
      extraHours = Math.max(1, Math.ceil(extraMillis / (60 * 60 * 1000)))
      const rate = spot.priceHour ?? 40
      extraAmount = extraHours * rate
      newStatus = 'pending_extra'
      bookingStatus = 'PENDING_EXTRA_PAYMENT'
      paymentStatus = 'PENDING_EXTRA'

      razorpayOrder = {
        id: `order_test_${Math.random().toString(36).slice(2, 11)}`,
        amount: extraAmount * 100,
        currency: 'INR',
        key: 'rzp_test_parkshare_mvp',
        bookingId: activeBooking.id,
        description: `ParkShare Late Checkout Extra Charge (${extraHours} hr @ ₹${rate}/hr)`,
      }
    }

    activeBooking.status = newStatus
    activeBooking.checkedOutISO = now.toISOString()
    activeBooking.extraAmount = extraAmount
    activeBooking.extraHours = extraHours
    activeBooking.razorpayOrder = razorpayOrder

    return {
      action: 'CHECK_OUT',
      bookingId: activeBooking.id,
      bookingCode: activeBooking.code,
      bookingStatus,
      paymentStatus,
      spot: {
        id: spot.id,
        title: spot.title,
        address: spot.address,
      },
      breakdown: {
        baseAmount: activeBooking.amount,
        scheduledStart: activeBooking.startISO,
        scheduledEnd: activeBooking.endISO,
        checkInTime: activeBooking.checkedInISO ?? activeBooking.startISO,
        checkOutTime: now.toISOString(),
        extraDurationMinutes,
        extraHours,
        hourlyRate: spot.priceHour ?? 40,
        extraAmount,
        totalAmount: activeBooking.amount + extraAmount,
        currency: 'INR',
        razorpayOrder,
      },
      message:
        extraAmount > 0
          ? `Checked out with ${extraHours} extra hour(s). Please complete the extra payment of ₹${extraAmount}.`
          : 'Checked out successfully! Thank you for using ParkShare.',
    }
  }

  const upcomingBooking = state.bookings.find(
    (b) => b.spotId === spot.id && b.status === 'upcoming' && b.isMine,
  )

  if (upcomingBooking) {
    // CHECK-IN FLOW
    upcomingBooking.status = 'active'
    upcomingBooking.checkedInISO = now.toISOString()

    const scheduledStart = new Date(upcomingBooking.startISO)
    const isEarly = now.getTime() < scheduledStart.getTime()

    return {
      action: 'CHECK_IN',
      bookingId: upcomingBooking.id,
      bookingCode: upcomingBooking.code,
      bookingStatus: 'ACTIVE',
      checkInTime: now.toISOString(),
      scheduledStart: upcomingBooking.startISO,
      scheduledEnd: upcomingBooking.endISO,
      isEarlyCheckIn: isEarly,
      spot: {
        id: spot.id,
        title: spot.title,
        address: spot.address,
        gateInstructions: spot.gateInstructions ?? 'Drive up to the gate and mention your ParkShare booking code.',
      },
      message: isEarly
        ? 'Checked in early! Your parking pass is active and billed from scheduled start.'
        : 'Checked in successfully! Your parking spot is active.',
    }
  }

  // Reject with specific reason
  const completedBooking = state.bookings.find((b) => b.spotId === spot.id && b.status === 'completed')
  if (completedBooking) {
    throw new Error(`Your booking at "${spot.title}" was already completed and checked out.`)
  }

  throw new Error(`No active or upcoming booking found for you at "${spot.title}". Please verify your parking location.`)
}

export async function payExtraAmount({ bookingId, razorpayPaymentId }) {
  await wait(jitter(400))
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking) throw new Error('Booking not found')

  booking.status = 'completed'
  booking.paymentStatus = 'COMPLETED'
  booking.extraPaymentId = razorpayPaymentId || `pay_test_${Math.random().toString(36).slice(2, 10)}`

  return {
    bookingId: booking.id,
    bookingStatus: 'COMPLETED',
    paymentStatus: 'COMPLETED',
    amountPaid: (booking.amount ?? 0) + (booking.extraAmount ?? 0),
    extraPaid: booking.extraAmount ?? 0,
    paymentId: booking.extraPaymentId,
    message: 'Payment received successfully. Booking is now complete!',
  }
}

export async function getSpotQr(spotId) {
  await wait(200)
  const spot = spotById(spotId) || spots[0]
  const payload = { parking_id: spot.id, issued_at: new Date().toISOString(), v: 1 }
  const raw = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `pk_${raw}.sig_mock_${spot.id}`

  return {
    spotId: spot.id,
    title: spot.title,
    address: spot.address,
    qrToken: token,
    issuedAt: new Date().toISOString(),
  }
}

export async function regenerateSpotQr(spotId, reason) {
  await wait(350)
  const spot = spotById(spotId) || spots[0]
  const payload = { parking_id: spot.id, issued_at: new Date().toISOString(), nonce: Math.random().toString(36).slice(2), v: 1 }
  const raw = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `pk_${raw}.sig_mock_reissued_${Date.now()}`

  return {
    spotId: spot.id,
    qrToken: token,
    issuedAt: new Date().toISOString(),
    message: 'New QR code generated. Previous physical QR codes have been invalidated immediately.',
  }
}

export async function getPendingExtraBookings() {
  await wait(150)
  return state.bookings.filter((b) => b.status === 'pending_extra' && b.isMine)
}

