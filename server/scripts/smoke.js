/**
 * End-to-end smoke test.
 *
 *   npm run smoke
 *
 * Boots the API in-process (unless SMOKE_BASE_URL points at a running server),
 * drives the whole marketplace flow over HTTP, then proves the booking
 * concurrency guarantee by firing more parallel bookings than there are bays.
 *
 * Requires a migrated + seeded database (`npm run migrate && npm run seed`).
 * Requires OTP_EXPOSE_IN_RESPONSE (defaults to true outside production) so the
 * test can read `devOtp` instead of an SMS.
 *
 * Exits non-zero if any step fails.
 */

// Must run before config/env.js is imported, and ESM hoists static imports -
// so everything below is loaded dynamically.
if (process.env.OTP_EXPOSE_IN_RESPONSE === undefined) process.env.OTP_EXPOSE_IN_RESPONSE = 'true'
if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'development'

const results = []
let stepNo = 0

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
}
const r2 = (n) => Math.round(n * 100) / 100

async function step(name, fn) {
  stepNo += 1
  const label = `${String(stepNo).padStart(2, '0')} ${name}`
  try {
    const detail = await fn()
    results.push({ label, ok: true, detail })
    console.log(`  [pass] ${label}${detail ? ` - ${detail}` : ''}`)
  } catch (err) {
    results.push({ label, ok: false, detail: err.message })
    console.log(`  [FAIL] ${label}\n         ${err.message}`)
  }
}

async function main() {
  const { default: env } = await import('../src/config/env.js')
  const { close } = await import('../src/config/db.js')
  const { createApp } = await import('../src/app.js')

  let base = process.env.SMOKE_BASE_URL
  let server = null

  if (!base) {
    server = createApp().listen(0)
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    base = `http://127.0.0.1:${server.address().port}`
  }
  console.log(`\nsmoke target: ${base}\n`)

  const api = async (method, pathname, { token, body, serviceKey, headers = {} } = {}) => {
    const h = { 'Content-Type': 'application/json', ...headers }
    if (token) h.Authorization = `Bearer ${token}`
    if (serviceKey) h['X-Service-Key'] = serviceKey
    const res = await fetch(`${base}${pathname}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    return { status: res.status, json, text }
  }

  const ok = (res, status, what) => {
    assert(res.status === status, `${what}: expected ${status}, got ${res.status} - ${res.text.slice(0, 300)}`)
    return res.json?.data
  }

  const iso = (offsetDays, hour) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const winA = { start: iso(2, 6), end: iso(2, 10) }
  const winB = { start: iso(3, 6), end: iso(3, 10) }
  const qs = (params) =>
    Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

  const phones = {
    pilgrim: '+919810000001',
    pilgrim2: '+919810000002',
    host: '+919800000002',
    admin: '+919800000001',
  }
  const tokens = {}
  const ctx = {}

  const login = async (which) => {
    const phone = phones[which]
    const req1 = await api('POST', '/api/v1/auth/otp/request', { body: { phone } })
    const data1 = ok(req1, 200, `otp request for ${which}`)
    assert(data1.devOtp, `devOtp missing for ${which} - set OTP_EXPOSE_IN_RESPONSE=true (is NODE_ENV=production?)`)
    const req2 = await api('POST', '/api/v1/auth/otp/verify', { body: { phone, code: data1.devOtp } })
    const data2 = ok(req2, 200, `otp verify for ${which}`)
    assert(data2.accessToken, `no accessToken returned for ${which}`)
    assert(String(data2.user.role), `no role returned for ${which}`)
    tokens[which] = data2.accessToken
    return `${data2.user.role} ${data2.user.phone}`
  }

  // ---------------------------------------------------------------- system
  await step('GET /health', async () => {
    const res = await api('GET', '/health')
    ok(res, 200, 'health')
    return 'process up'
  })

  await step('GET /ready reports database up + geo mode', async () => {
    const res = await api('GET', '/ready')
    // /ready and /openapi.json answer with a bare object, not the { data } envelope.
    assert(res.status === 200, `ready: expected 200, got ${res.status} - ${res.text.slice(0, 200)}`)
    const data = res.json
    assert(data.database === 'up', `database reported ${data.database}`)
    assert(typeof data.postgis === 'boolean', `postgis was ${data.postgis}`)
    if (data.postgis && process.env.SMOKE_ALLOW_POSTGIS !== '1') {
      throw new Error('postgis is true but this run expected the haversine fallback (set SMOKE_ALLOW_POSTGIS=1 to allow)')
    }
    return `database=up postgis=${data.postgis} (haversine fallback)`
  })

  await step('GET /openapi.json builds a valid spec', async () => {
    const res = await api('GET', '/openapi.json')
    assert(res.status === 200, `openapi: expected 200, got ${res.status}`)
    const spec = res.json
    assert(spec.openapi === '3.0.3', `unexpected openapi ${spec.openapi}`)
    const paths = Object.keys(spec.paths ?? {})
    assert(paths.length >= 40, `only ${paths.length} documented paths`)
    for (const p of ['/bookings', '/pricing/surge', '/reviews', '/admin/analytics']) {
      assert(spec.paths[p], `path ${p} missing from spec`)
    }
    return `${paths.length} paths`
  })

  await step('GET /docs serves Swagger UI', async () => {
    const res = await api('GET', '/docs/')
    assert(res.status === 200, `expected 200, got ${res.status}`)
    return 'swagger ui html'
  })

  // ------------------------------------------------------------------- auth
  await step('OTP login: pilgrim / host / admin', async () => {
    const roles = []
    for (const who of ['pilgrim', 'host', 'admin']) roles.push(await login(who))
    ctx.pilgrim2 = null
    return roles.join(', ')
  })

  if (!tokens.pilgrim || !tokens.host || !tokens.admin) {
    return finish(server, close, 'authentication failed - cannot continue')
  }

  await step('OTP login: second pilgrim (for the concurrency burst)', async () => {
    ctx.pilgrim2 = await login('pilgrim2')
    return ctx.pilgrim2
  })

  // ----------------------------------------------------------------- spots
  await step('GET /host/spots picks a bookable listing', async () => {
    const data = ok(await api('GET', '/api/v1/host/spots', { token: tokens.host }), 200, 'host spots')
    const verified = data.filter((s) => s.status === 'verified')
    assert(verified.length, 'no verified spots - run `npm run seed`')
    verified.sort((a, b) => Number(b.capacity.car) - Number(a.capacity.car))
    ctx.spot = verified[0]
    assert(Number(ctx.spot.capacity.car) >= 20, `car capacity ${ctx.spot.capacity.car} too low for the burst test`)
    return `${ctx.spot.title} (car bays: ${ctx.spot.capacity.car})`
  })

  await step('GET /spots/nearby with a start/end window (haversine)', async () => {
    const res = await api(
      'GET',
      `/api/v1/spots/nearby?${qs({
        lat: 19.9975,
        lng: 73.3118,
        radius_km: 12,
        vehicle_type: 'car',
        start: winA.start,
        end: winA.end,
      })}`,
    )
    const data = ok(res, 200, 'nearby')
    assert(Array.isArray(data), 'expected data to be an array')
    assert(data.length > 0, 'nearby returned no spots for the window')
    assert(
      data.every((s) => typeof s.distanceKm === 'number'),
      'distanceKm is not numeric - haversine distanceSql path broken',
    )
    const found = data.find((s) => s.id === ctx.spot.id)
    assert(found, `listed spot ${ctx.spot.title} missing from nearby results`)
    return `${data.length} spots, nearest ${data[0].distanceKm} km`
  })

  // --------------------------------------------------------------- pricing
  await step('POST /bookings/quote prices consistently (12% platform fee)', async () => {
    const data = ok(
      await api('POST', '/api/v1/bookings/quote', {
        token: tokens.pilgrim,
        body: { spotId: ctx.spot.id, start: winA.start, end: winA.end, vehicleType: 'car', plan: 'hourly' },
      }),
      200,
      'quote',
    )
    const p = data.pricing
    assert(p, 'no pricing block in quote')
    assert(p.hours === 4, `expected 4 hours, got ${p.hours}`)
    const expectedFee = r2((p.baseAmount + p.surgeAmount) * 0.12)
    assert(Math.abs(p.platformFee - expectedFee) < 0.02, `platformFee ${p.platformFee} != 12% of base+surge ${expectedFee}`)
    const expectedTotal = r2(p.baseAmount + p.surgeAmount + p.platformFee)
    assert(Math.abs(p.total - expectedTotal) < 0.02, `total ${p.total} != base+surge+fee ${expectedTotal}`)
    assert(data.baysFree > 0, `expected free bays, got ${data.baysFree}`)
    ctx.quote1 = data
    return `base ${p.baseAmount} fee ${p.platformFee} total ${p.total} (${p.surgeMultiplier}x)`
  })

  await step('POST /pricing/surge accepts the service key (no user token)', async () => {
    const noKey = await api('POST', '/api/v1/pricing/surge', {
      body: { zoneId: 'ramkund', windowStart: winA.start, windowEnd: winA.end, multiplier: 2.5 },
    })
    assert(noKey.status === 403, `missing service key should be 403, got ${noKey.status}`)

    const data = ok(
      await api('POST', '/api/v1/pricing/surge', {
        serviceKey: env.serviceKey,
        body: {
          zoneId: ctx.spot.zoneId,
          windowStart: winA.start,
          windowEnd: winA.end,
          multiplier: 2.5,
          reason: 'smoke test surge window',
          modelVersion: 'smoke',
        },
      }),
      201,
      'surge write',
    )
    assert(Number(data.multiplier) === 2.5, `stored multiplier ${data.multiplier}`)
    return `zone ${data.zoneId} at ${data.multiplier}x`
  })

  await step('surge propagates into the next quote (highest multiplier wins)', async () => {
    const data = ok(
      await api('POST', '/api/v1/bookings/quote', {
        token: tokens.pilgrim,
        body: { spotId: ctx.spot.id, start: winA.start, end: winA.end, vehicleType: 'car' },
      }),
      200,
      'quote after surge',
    )
    assert(Number(data.pricing.surgeMultiplier) === 2.5, `surgeMultiplier ${data.pricing.surgeMultiplier}, expected 2.5`)
    assert(data.pricing.surgeApplied === true, 'surgeApplied should be true')
    assert(Number(data.pricing.surgeAmount) > 0, 'surgeAmount should be > 0')
    ctx.quote2 = data
    return `surge ${data.pricing.surgeMultiplier}x adds ${data.pricing.surgeAmount}`
  })

  // -------------------------------------------------------------- booking
  await step('POST /bookings creates a booking and returns a one-time PIN', async () => {
    const data = ok(
      await api('POST', '/api/v1/bookings', {
        token: tokens.pilgrim,
        body: {
          spotId: ctx.spot.id,
          start: winA.start,
          end: winA.end,
          vehicleNumber: 'MH15AB1234',
          vehicleType: 'car',
          plan: 'hourly',
        },
      }),
      201,
      'create booking',
    )
    assert(/^\d{6}$/.test(String(data.pinCode)), `pinCode was ${data.pinCode}`)
    assert(data.status === 'confirmed', `status ${data.status}`)
    assert(data.code, 'booking code missing')
    assert(
      Math.abs(Number(data.pricing.total) - Number(ctx.quote2.pricing.total)) < 0.02,
      `stored total ${data.pricing.total} drifted from quote ${ctx.quote2.pricing.total}`,
    )
    ctx.booking = data
    ctx.pin = String(data.pinCode)
    return `${data.code} pin ${ctx.pin} total ${data.pricing.total}`
  })

  await step('POST /bookings/{id}/checkin with the PIN', async () => {
    const data = ok(
      await api('POST', `/api/v1/bookings/${ctx.booking.id}/checkin`, {
        token: tokens.pilgrim,
        body: { pin: ctx.pin },
      }),
      200,
      'check in',
    )
    assert(data.status === 'checked_in', `status ${data.status}`)
    return `status ${data.status}`
  })

  await step('POST /bookings/{id}/checkout by the host', async () => {
    const data = ok(
      await api('POST', `/api/v1/bookings/${ctx.booking.id}/checkout`, { token: tokens.host }),
      200,
      'check out',
    )
    assert(data.status === 'completed', `status ${data.status}`)
    assert(Number(data.payout) > 0, `payout ${data.payout}`)
    return `completed, payout ${data.payout}`
  })

  await step('POST /reviews after completion', async () => {
    const data = ok(
      await api('POST', '/api/v1/reviews', {
        token: tokens.pilgrim,
        body: { bookingId: ctx.booking.id, rating: 5, comment: 'Smoke test review - gate staff were quick.' },
      }),
      201,
      'review',
    )
    assert(Number(data.rating) === 5, `rating ${data.rating}`)
    const dup = await api('POST', '/api/v1/reviews', {
      token: tokens.pilgrim,
      body: { bookingId: ctx.booking.id, rating: 4 },
    })
    assert(dup.status === 409, `duplicate review should be 409, got ${dup.status}`)
    return 'stored, duplicate rejected with 409'
  })

  // ----------------------------------------------------------------- admin
  await step('POST /admin/spots/{id}/verify approves a pending listing', async () => {
    const list = ok(
      await api('GET', '/api/v1/admin/spots/submissions?status=pending', { token: tokens.admin }),
      200,
      'submissions',
    )
    assert(Array.isArray(list), 'expected an array of submissions')
    if (!list.length) {
      ctx.approved = null
      return 'none pending (already approved on an earlier run)'
    }
    const data = ok(
      await api('POST', `/api/v1/admin/spots/${list[0].id}/verify`, {
        token: tokens.admin,
        body: { decision: 'approved', notes: 'smoke test approval' },
      }),
      200,
      'verify',
    )
    assert(data.status === 'verified', `status ${data.status}`)
    assert(Number(data.slotsCreated) > 0, `slotsCreated ${data.slotsCreated} - bays were not materialised`)
    ctx.approved = data
    return `${list[0].title} -> verified, ${data.slotsCreated} bays materialised`
  })

  await step('approved listing is immediately bookable (slots exist)', async () => {
    if (!ctx.approved) return 'skipped - nothing approved in this run'
    const data = ok(
      await api('POST', '/api/v1/bookings/quote', {
        token: tokens.pilgrim,
        body: { spotId: ctx.approved.id, start: winA.start, end: winA.end, vehicleType: 'car' },
      }),
      200,
      'quote on approved spot',
    )
    assert(data.baysFree > 0, `baysFree ${data.baysFree} - materialiseSlots did not run on approval`)
    return `${data.baysFree} car bays free`
  })

  await step('GET /admin/analytics', async () => {
    const data = ok(await api('GET', '/api/v1/admin/analytics', { token: tokens.admin }), 200, 'analytics')
    for (const key of ['live_spots', 'gross_revenue', 'platform_revenue', 'trend']) {
      assert(key in data, `analytics missing ${key}`)
    }
    assert(Array.isArray(data.trend) && data.trend.length >= 7, 'trend should be a daily series')
    return `live ${data.live_spots}, revenue ${data.gross_revenue}`
  })

  await step('GET /admin/audit-logs records our actions', async () => {
    const data = ok(await api('GET', '/api/v1/admin/audit-logs?pageSize=50', { token: tokens.admin }), 200, 'audit')
    assert(Array.isArray(data) && data.length > 0, 'audit log is empty')
    const actions = new Set(data.map((e) => e.action))
    for (const want of ['booking.create', 'booking.checkout', 'surge.upsert', 'spot.approved']) {
      assert(actions.has(want), `audit log missing action ${want} (saw: ${[...actions].join(', ')})`)
    }
    return `${data.length} entries, ${actions.size} distinct actions`
  })

  // ------------------------------------------------------------ concurrency
  await step(`burst: ${Number(ctx.spot.capacity.car) + 5} parallel bookings must claim exactly ${ctx.spot.capacity.car} bays`, async () => {
    const capacity = Number(ctx.spot.capacity.car)
    const attempts = capacity + 5
    const who = [tokens.pilgrim, tokens.pilgrim2 ?? tokens.pilgrim]

    const responses = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        api('POST', '/api/v1/bookings', {
          token: who[i % who.length],
          body: {
            spotId: ctx.spot.id,
            start: winB.start,
            end: winB.end,
            vehicleNumber: `MH15AA${String(1000 + i)}`,
            vehicleType: 'car',
          },
        }),
      ),
    )

    const created = responses.filter((r) => r.status === 201)
    const rejected = responses.filter((r) => r.status !== 201)
    const other = rejected.filter((r) => r.status !== 409)

    assert(
      created.length === capacity,
      `expected exactly ${capacity} of ${attempts} to succeed, got ${created.length}`,
    )
    assert(other.length === 0, `${other.length} unexpected non-409 failures: ${other.map((r) => `${r.status} ${r.text.slice(0, 120)}`).join(' | ')}`)

    const codes = new Set(rejected.map((r) => r.json?.error?.code))
    for (const c of codes) assert(c === 'SLOT_TAKEN' || c === 'NO_BAYS_FREE', `unexpected error code ${c}`)

    const pinSeen = created.map((r) => r.json.data.pinCode)
    assert(pinSeen.every((p) => /^\d{6}$/.test(String(p))), 'a successful booking returned a malformed PIN')

    // No bay may be double-assigned: capacity bookings consumed every bay, so
    // the window must now have zero free bays left.
    const after = ok(
      await api('POST', '/api/v1/bookings/quote', {
        token: tokens.pilgrim,
        body: { spotId: ctx.spot.id, start: winB.start, end: winB.end, vehicleType: 'car' },
      }),
      200,
      'quote after burst',
    )
    assert(Number(after.baysFree) === 0, `baysFree ${after.baysFree} after ${created.length} bookings - a bay is double-assigned`)

    const ids = created.map((r) => r.json.data.id)
    assert(new Set(ids).size === ids.length, 'duplicate booking ids returned')

    return `${created.length}/${attempts} created, ${rejected.length} rejected 409, baysFree=0`
  })

  return finish(server, close)
}

function finish(server, close, fatal) {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${'-'.repeat(70)}`)
  console.log(`${results.length - failed.length}/${results.length} checks passed`)
  if (fatal) console.log(`ABORTED: ${fatal}`)
  if (failed.length) {
    console.log('\nfailures:')
    for (const f of failed) console.log(`  - ${f.label}: ${f.detail}`)
  }
  console.log(`${'-'.repeat(70)}`)

  const done = async (code) => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve))
      await close()
    } catch {
      /* best effort */
    }
    process.exit(code)
  }

  if (failed.length || fatal) return done(1)
  return done(0)
}

main().catch((err) => {
  console.error('\nsmoke test crashed:', err)
  process.exit(1)
})
