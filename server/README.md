# Nashik Parking Connect — API

Node/Express + PostgreSQL REST API for the Kumbh Mela parking marketplace.
Pilgrims search and book parking bays, hosts list and manage plots, admins verify
listings and monitor occupancy.

Runs on **PostGIS when available, and on a plain Postgres install otherwise** —
geospatial search falls back to an inline haversine expression, so nothing blocks
on an extension install.

---

## Quick start

```bash
cd server
npm install                 # already installed in this repo
cp .env.example .env        # then edit DATABASE_URL and the secrets
createdb nashik_parking     # or use an existing database

npm run migrate             # applies sql/001_init.sql
npm run seed                # demo zones, users, spots and bays
npm run dev                 # http://localhost:4000
```

Then in another terminal:

```bash
npm run smoke               # drives the whole flow over HTTP
```

Interactive API docs: <http://localhost:4000/docs>
Machine-readable spec: <http://localhost:4000/openapi.json>

---

## Requirements

- Node 20+
- PostgreSQL 14+ (the schema uses `btree_gist`, `pgcrypto`, generated columns)
- PostGIS is **optional**

---

## Environment variables

Copy `.env.example` to `.env`. Values shown are the defaults.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` refuses the built-in dev secrets |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/nashik_parking` | **set this** |
| `DATABASE_POOL_MAX` | `10` | pool size |
| `DATABASE_SSL` | `false` | |
| `JWT_SECRET` | `dev-only-change-me-access` | access tokens; required in production |
| `JWT_REFRESH_SECRET` | `dev-only-change-me-refresh` | refresh tokens; required in production |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | `30m` / `30d` | |
| `SERVICE_KEY` | `dev-only-change-me-service` | `X-Service-Key` for `/pricing/surge`; required in production |
| `OTP_EXPOSE_IN_RESPONSE` | `true` outside production | returns `devOtp` from `/auth/otp/request` |
| `OTP_TTL_SECONDS` | `600` | |
| `OTP_MAX_ATTEMPTS` | `5` | |
| `OTP_RATE_LIMIT_PER_15MIN` | `5` | per phone; the OTP routes allow 4× this |
| `PLATFORM_FEE_PCT` | `12` | platform commission |
| `CURRENCY` | `INR` | |
| `CANCEL_FREE_BEFORE_HOURS` | `2` | free-cancellation cutoff |
| `DEFAULT_SEARCH_RADIUS_KM` / `MAX_SEARCH_RADIUS_KM` | `8` / `25` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Vite dev server |
| `RATE_LIMIT_PER_MINUTE` | `600` dev / `300` prod | per IP |
| `TRUST_PROXY` | `false` | set `1` behind a reverse proxy |
| `MAX_ACTIVE_BOOKINGS_PER_USER` | `5` | **not currently enforced** — see *Known gaps* |

Production start-up **fails fast** if `JWT_SECRET`, `JWT_REFRESH_SECRET` or
`SERVICE_KEY` still hold the dev placeholders.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | `node --watch src/server.js` |
| `npm start` | production start |
| `npm run migrate` | applies every `sql/*.sql` not yet in `schema_migrations` |
| `npm run seed` | idempotent demo data (runs `migrate` first) |
| `npm run db:reset` | `migrate --fresh` (drops `schema public`) then `seed` |
| `npm run smoke` | end-to-end HTTP test, exits non-zero on failure |

### Migrations

`scripts/migrate.js` is a forward-only runner: each `sql/*.sql` file is applied
once inside a transaction and recorded in `schema_migrations` with its sha256.
Editing an already-applied file is reported, not silently ignored — add a new
numbered file instead. `--fresh` drops `schema public` first and re-applies all.

### Seed data

Zones use **text slug ids** (`ramkund`, `sadashiv-gaon`, `karanji`,
`doodsangli`, `ambad`) — not UUIDs.

| Phone | Role | Notes |
| --- | --- | --- |
| `+919800000001` | admin | Kumbh Ops |
| `+919800000002` | host | Suresh Patil — Gangapur Road Open Plot, Shivaji Nagar ground |
| `+919800000003` | host | Anita Deshmukh — 3 listings |
| `+919800000004` | host | Ravi Joshi — one **pending** listing, for the approval flow |
| `+919810000001` | pilgrim | Priya Sharma |
| `+919810000002` | pilgrim | Mahesh Kulkarni |

Every listing gets `slots` rows at seed time, so spots are bookable immediately.
Bays are also materialised whenever a listing is approved.

---

## Auth: OTP + JWT

There is no password. A phone number + 6-digit OTP is exchanged for a JWT pair.

```bash
# 1. request an OTP (dev returns it as devOtp)
curl -s -X POST http://localhost:4000/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919810000001"}'
# -> {"data":{"phone":"+919810000001","expiresInSeconds":600,"devOtp":"123456"}}

# 2. verify it -> access + refresh token
curl -s -X POST http://localhost:4000/api/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919810000001","code":"123456"}'
# -> {"data":{"user":{...},"accessToken":"...","refreshToken":"..."}}

# 3. call an authenticated route
curl -s http://localhost:4000/api/v1/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"
```

- `role` on `/auth/otp/verify` is honoured **only when the account is created**;
  existing accounts keep their seeded role.
- Refresh tokens rotate on every use; replay of a rotated token is rejected.
- With `OTP_EXPOSE_IN_RESPONSE=false` the OTP is never returned or logged — it is
  sent by SMS in a real deployment.

---

## Booking concurrency

Bookings pin a **concrete `slots` row**. `POST /bookings` runs in one
transaction:

1. `SELECT ... FOR UPDATE SKIP LOCKED` claims a free bay, so two racing requests
   can never pick the same row.
2. The overlap is re-checked *under* that lock.
3. A Postgres `EXCLUDE USING GIST (slot_id, time_window)` constraint, active for
   `confirmed`/`checked_in` rows, is the final guard. Violations surface as
   **409 `SLOT_TAKEN`**.
4. Running out of bays is **409 `NO_BAYS_FREE`**.

Pricing is computed by `src/lib/pricing.js` **inside the same transaction** as
the insert, so a stored total can never drift from its quote. The platform fee
is `PLATFORM_FEE_PCT` (12%) of `base + surge`.

Money-related state transitions and every admin action are written to
`audit_logs`.

The check-in PIN is `sha256`-hashed at rest and returned in plaintext exactly
once, on create/regenerate. PINs, OTPs and booking codes all come from
`crypto.randomInt`, and comparisons use `crypto.timingSafeEqual`.

---

## Surge pricing (service hook)

`POST /api/v1/pricing/surge` is for a future demand/ML service — it is
authenticated with **`X-Service-Key`, not a user token**. It never predicts
anything itself; it only stores multipliers that quoting reads back.

```bash
curl -s -X POST http://localhost:4000/api/v1/pricing/surge \
  -H 'Content-Type: application/json' \
  -H "X-Service-Key: $SERVICE_KEY" \
  -d '{
    "zoneId": "ramkund",
    "windowStart": "2027-01-14T06:00:00.000Z",
    "windowEnd":   "2027-01-14T18:00:00.000Z",
    "multiplier": 2.5,
    "reason": "Shahi Snan expected",
    "modelVersion": "demand-v3"
  }'
```

Windows may overlap; when several match a booking the **highest** multiplier
wins. Retries are idempotent (the same zone+window is upserted).
`GET /api/v1/pricing/surge` is public; `DELETE /api/v1/pricing/surge/{id}`
also requires the service key.

---

## PostGIS (optional)

`sql/001_init.sql` creates the `postgis` extension **only if it is available**,
and then adds generated `geography` columns plus GIST indexes to `zones` and
`parking_spots`. Without it those columns simply do not exist.

`config/postgis.js` exposes `hasPostgis()` and `distanceSql()`; search builds
either `ST_DWithin`/`ST_Distance` or an inline haversine expression at runtime.
Nothing else in the codebase branches on it.

```bash
GET /ready
# {"status":"ready","database":"up","postgis":false}
```

To enable PostGIS: install the extension files for your server version, then
re-run `npm run db:reset` (the DDL is conditional, so it must re-run to add the
columns).

---

## API surface

All routes are under `/api/v1` unless noted.

| Area | Routes |
| --- | --- |
| System | `GET /health`, `GET /ready`, `GET /docs`, `GET /openapi.json` |
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `GET`/`PATCH /auth/me` |
| Discovery | `GET /zones`, `GET /zones/{id}`, `GET /spots/nearby`, `GET /spots/{id}`, `GET /spots/{id}/availability`, `GET /spots/{id}/reviews` |
| Bookings | `POST /bookings/quote`, `POST /bookings`, `GET /bookings`, `GET /bookings/{id}`, `POST /bookings/{id}/cancel`, `POST /bookings/{id}/checkin`, `POST /bookings/{id}/checkout`, `POST /bookings/{id}/pin` |
| Host | `GET`/`POST /host/spots`, `GET`/`PATCH`/`DELETE /host/spots/{id}`, `POST /host/spots/{id}/submit`, `PATCH /host/spots/{id}/availability`, `GET /host/bookings`, `GET /host/earnings`, `GET /host/dashboard`, `POST /host/verify-pin` |
| Admin | `GET /admin/spots/submissions`, `POST /admin/spots/{id}/verify`, `POST /admin/hosts/{id}/suspend`, `GET /admin/occupancy`, `GET /admin/issues`, `POST /admin/issues/{id}/resolve`, `GET /admin/analytics`, `GET /admin/audit-logs`, `GET /admin/payouts`, `POST /admin/payouts/{id}/paid` |
| Pricing | `POST`/`GET /pricing/surge`, `DELETE /pricing/surge/{id}`, `GET /pricing/quote`, `PATCH /pricing/config` |
| Reviews | `POST /reviews`, `POST /reports` |

Responses use `{ "data": ... }`, or `{ "data": [...], "meta": {...} }` for
paginated lists, or `{ "error": { "code", "message", "details?" } }` on failure.

Roles are `pilgrim` (what the frontend calls *renter*), `host`, and `admin`.

---

## Smoke test

`npm run smoke` boots the API in-process (or targets `SMOKE_BASE_URL`) and
drives the full marketplace flow over HTTP:

readiness → OTP login for pilgrim/host/admin → nearby search with a time
window → quote → surge write with `X-Service-Key` → surge reflected in the next
quote → booking + one-time PIN → PIN check-in → host checkout → review →
admin approval (asserting bays were materialised) → analytics → audit log →
**concurrency burst**.

The burst fires `capacity + 5` simultaneous bookings for one spot/window and
asserts that **exactly `capacity` succeed**, every loser returns `409`, and the
window afterwards has `baysFree === 0` (which is what proves no bay was
double-assigned).

It requires a migrated + seeded database and `OTP_EXPOSE_IN_RESPONSE` (on by
default outside production).

---

## Verification status

Run against a live database when available; otherwise statically verified.

| Verified live (no DB needed) | Verified statically only |
| --- | --- |
| `npm run dev` boots and keeps running | `sql/001_init.sql` against PostgreSQL 18 grammar |
| Boots **degraded** when the DB is down: `/health` 200, `/ready` 503 | `migrate.js` / `seed.js` SQL vs schema |
| `GET /docs`, `GET /openapi.json` (42 paths) | every `table.column` reference resolves to a real column |
| All 42 routes reachable: `400`/`401`/`403`/`500` instead of `404` | route→service argument shapes |
| Missing `X-Service-Key` → `403`; bad key → `403` | transaction, exclusion-constraint and error mapping |
| Auth guards, zod validation, rate limiting | haversine / PostGIS SQL paths |
| Frontend `npm run lint` → exit 0, `npm run build` → exit 0 | seed data and demo booking |
| Frontend `npm run dev` serves the app on :5173 | |
| `npm run smoke` harness itself (starts, reports, exits 1 on failure) | |

**Not yet executed end-to-end:** `migrate`, `seed`, and steps 02+ of the smoke
test, because the local PostgreSQL password is still unknown. Run
`npm run migrate && npm run seed && npm run smoke` to close that gap — the API
will start serving DB-backed routes as soon as `DATABASE_URL` authenticates.

---

## Production checklist

- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SERVICE_KEY` (start-up refuses the dev values)
- [ ] Point `DATABASE_URL` at a real database with a strong password; use SSL if remote (`DATABASE_SSL=true`)
- [ ] Set `CORS_ORIGIN` to the deployed frontend origin, not `*`
- [ ] `OTP_EXPOSE_IN_RESPONSE=false` (default in production) and wire a real SMS provider
- [ ] Put the app behind a proxy and set `TRUST_PROXY=1` so rate limiting and audit logs see real client IPs
- [ ] Tune `RATE_LIMIT_PER_MINUTE` for your traffic
- [ ] Run migrations as a superuser once — `CREATE EXTENSION pgcrypto` / `btree_gist` need it unless marked trusted
- [ ] Schedule `npm run db:reset`-style backups; `audit_logs` is append-only and money-bearing
- [ ] Terminate TLS at the proxy; keep `DATABASE_SSL=true` for public networks
- [ ] Scrape `/health` (liveness) and `/ready` (readiness) — `/ready` returns `503` when the DB is down
- [ ] Serve `/docs` only if you want the spec public

## Known gaps

- `MAX_ACTIVE_BOOKINGS_PER_USER` is read from the environment but **not
  enforced** by the booking path yet.
- `PATCH /host/spots/{id}` accepts `zoneId`, `minBookingHours` and
  `maxBookingHours`, but `updateHostSpot` does not persist them — those fields
  are effectively read-only after creation.
- Nearby search always requires at least one free bay of the requested vehicle
  type; a spot with no bays of that type is never returned even without a time
  window.
- **Host check-in needs a PIN.** `POST /bookings/{id}/checkin` accepts a QR
  token *or* the guest's 6-digit PIN — there is no bare check-in. The host
  dashboard currently calls it without one, so the check-in button needs a PIN
  prompt added to the UI.
- **No endpoint yet** for ghats, waitlists or saved listings. The frontend's
  `getGhatPoints`, `joinWaitlist` and `setSaved` therefore stay on local
  fixtures even when `VITE_USE_MOCK=false`.

## Frontend real mode

The frontend defaults to mock data (`VITE_USE_MOCK=true`) and needs no backend
to run. To point it at this API:

```bash
# root .env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:4000/api/v1   # must end in /api/v1
```

`src/api/index.js` maps the mock contract onto these routes and unwraps the
`{ data }` / `{ data, meta }` envelopes, so no screen has to change. Two
response shapes are approximations rather than exact matches:

- `getAdminOverview()` merges `GET /admin/analytics` with `GET /admin/occupancy`
  and buckets zone-level `occupancyPct` into available/filling/full.
- `getHostSummary()` derives `occupancy` from bay totals and reports
  `waitlist: 0` (no waitlist concept on the backend).
