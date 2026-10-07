-- =============================================================================
-- Nashik Parking Connect - core schema
--
-- Requires PostgreSQL 14+. PostGIS is used when the extension is available
-- (geography column + GIST index + ST_DWithin search); without it the app
-- falls back to an inline haversine distance expression, so the schema still
-- works on a plain Postgres install.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- needed for the exclusion constraint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') THEN
    CREATE EXTENSION IF NOT EXISTS postgis;
  END IF;
END
$$;

-- ---------------------------------------------------------------- app settings
CREATE TABLE IF NOT EXISTS app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('platform_fee_pct', '12'::jsonb),
  ('currency', '"INR"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------ users
-- Single table for all three roles, matching the frontend mock. role is either
-- 'pilgrim' (renter), 'host' (private plot owner) or 'admin' (Kumbh ops).
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text NOT NULL UNIQUE,
  name          text,
  email         text,
  role          text NOT NULL DEFAULT 'pilgrim'
                CHECK (role IN ('pilgrim', 'host', 'admin')),
  photo_url     text,
  is_verified   boolean NOT NULL DEFAULT false,
  is_suspended  boolean NOT NULL DEFAULT false,
  suspended_reason text,
  -- host profile
  host_since    timestamptz,
  response_time text,
  upi_id        text,
  rating        numeric(2,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  rating_count  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users (phone);

-- ----------------------------------------------------------------------- zones
-- Predefined Kumbh Mela zones. Drives demand tagging + surge multipliers.
-- `id` is a stable text slug (e.g. 'ramkund') so seeded ids stay readable.
CREATE TABLE IF NOT EXISTS zones (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  mela_note   text,
  latitude    numeric(9,6) NOT NULL,
  longitude   numeric(9,6) NOT NULL,
  demand_tag  text NOT NULL DEFAULT 'normal'
              CHECK (demand_tag IN ('low', 'normal', 'high', 'surge')),
  sort_order  integer NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE 'ALTER TABLE zones ADD COLUMN IF NOT EXISTS location geography(Point,4326)
             GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED';
    EXECUTE 'CREATE INDEX IF NOT EXISTS zones_location_gist ON zones USING GIST (location)';
  END IF;
END
$$;

-- ------------------------------------------------------------------ parking spots
CREATE TABLE IF NOT EXISTS parking_spots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  zone_id            text NOT NULL REFERENCES zones (id) ON DELETE RESTRICT,
  title              text NOT NULL,
  description        text,
  address            text NOT NULL,
  landmark           text,
  latitude           numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude          numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- capacity per vehicle type; `slots` rows are materialised on approval
  capacity_2w        integer NOT NULL DEFAULT 0 CHECK (capacity_2w >= 0),
  capacity_car       integer NOT NULL DEFAULT 0 CHECK (capacity_car >= 0),
  capacity_bus       integer NOT NULL DEFAULT 0 CHECK (capacity_bus >= 0),
  price_per_hour     numeric(10,2) NOT NULL CHECK (price_per_hour >= 0),
  price_per_day      numeric(10,2) NOT NULL CHECK (price_per_day >= 0),
  min_booking_hours  numeric(4,1) NOT NULL DEFAULT 1 CHECK (min_booking_hours > 0),
  max_booking_hours  numeric(5,1) NOT NULL DEFAULT 24 CHECK (max_booking_hours >= min_booking_hours),
  -- availability windows, stored as a JSON array of {days:[0-6],from:"05:00",to:"23:00"}
  availability_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  features           jsonb NOT NULL DEFAULT '[]'::jsonb,
  surface            text,
  clearance_m        numeric(4,1),
  gate_instructions  text,
  check_in_from      time NOT NULL DEFAULT '05:00',
  check_out_by       time NOT NULL DEFAULT '23:00',
  photos             jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('draft', 'pending', 'verified', 'rejected', 'suspended')),
  is_accepting       boolean NOT NULL DEFAULT true,
  -- admin review outcome, for both approvals and rejections
  review_notes       text,
  reviewed_at        timestamptz,
  reviewed_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  rating             numeric(2,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  review_count       integer NOT NULL DEFAULT 0,
  instant_book       boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spots_host_idx ON parking_spots (host_id);
CREATE INDEX IF NOT EXISTS spots_zone_idx ON parking_spots (zone_id);
CREATE INDEX IF NOT EXISTS spots_status_idx ON parking_spots (status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE 'ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS location geography(Point,4326)
             GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED';
    EXECUTE 'CREATE INDEX IF NOT EXISTS spots_location_gist ON parking_spots USING GIST (location)';
  END IF;
END
$$;

-- ------------------------------------------------------------------------ slots
-- One row per physical bay, materialised when a listing is approved. This is
-- what makes double-booking impossible: a booking pins a specific slot, and
-- overlapping windows on the same slot are rejected by the constraint below.
CREATE TABLE IF NOT EXISTS slots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id               uuid NOT NULL REFERENCES parking_spots (id) ON DELETE CASCADE,
  vehicle_type          text NOT NULL CHECK (vehicle_type IN ('2w', 'car', 'bus')),
  code                  text NOT NULL,
  -- host-side switch: false means the bay is blocked even if it is free
  is_currently_available boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spot_id, code)
);

CREATE INDEX IF NOT EXISTS slots_spot_idx ON slots (spot_id, vehicle_type);

-- --------------------------------------------------------------------- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  spot_id         uuid NOT NULL REFERENCES parking_spots (id) ON DELETE RESTRICT,
  slot_id         uuid NOT NULL REFERENCES slots (id) ON DELETE RESTRICT,
  vehicle_type    text NOT NULL CHECK (vehicle_type IN ('2w', 'car', 'bus')),
  vehicle_number  text NOT NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  time_window     tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time)) STORED,
  hours           numeric(6,2) NOT NULL CHECK (hours > 0),
  pricing_plan    text NOT NULL DEFAULT 'hourly' CHECK (pricing_plan IN ('hourly', 'daily')),
  base_amount     numeric(10,2) NOT NULL CHECK (base_amount >= 0),
  surge_multiplier numeric(4,2) NOT NULL DEFAULT 1 CHECK (surge_multiplier > 0),
  surge_applied   boolean NOT NULL DEFAULT false,
  surge_amount    numeric(10,2) NOT NULL DEFAULT 0 CHECK (surge_amount >= 0),
  platform_fee    numeric(10,2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  amount          numeric(10,2) NOT NULL CHECK (amount >= 0),
  status          text NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'checked_in', 'completed', 'cancelled')),
  -- short lived gate credential; only the sha256 hash is stored
  check_in_pin_hash text NOT NULL,
  qr_token         text,
  pin_attempts     integer NOT NULL DEFAULT 0,
  notes            text,
  checked_in_at    timestamptz,
  checked_out_at   timestamptz,
  cancelled_at     timestamptz,
  cancellation_reason text,
  refund_amount    numeric(10,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS bookings_spot_idx ON bookings (spot_id, start_time DESC);
CREATE INDEX IF NOT EXISTS bookings_slot_idx ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_window_gist ON bookings USING GIST (time_window);

-- Hard guarantee against double booking: one active booking per slot per
-- overlapping time window. Concurrent inserts that race past the row-lock
-- allocation in the service are rejected here too.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_slot_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_slot_no_overlap
  EXCLUDE USING GIST (slot_id WITH =, time_window WITH &&)
  WHERE (status IN ('confirmed', 'checked_in'));

-- --------------------------------------------------------------------- payouts
CREATE TABLE IF NOT EXISTS host_payouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  booking_id  uuid NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
  amount      numeric(10,2) NOT NULL CHECK (amount >= 0),
  platform_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'processing', 'paid', 'on_hold')),
  paid_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payouts_host_idx ON host_payouts (host_id, created_at DESC);

-- --------------------------------------------------------------------- reviews
CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
  spot_id     uuid NOT NULL REFERENCES parking_spots (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_spot_idx ON reviews (spot_id, created_at DESC);

-- ------------------------------------------------------------------ zone demand
-- Surge hook. The ML/pricing service writes multipliers here; this service only
-- reads them when quoting a booking. Never computes demand itself.
CREATE TABLE IF NOT EXISTS zone_demand (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id       text NOT NULL REFERENCES zones (id) ON DELETE CASCADE,
  window_start  timestamptz NOT NULL,
  window_end    timestamptz NOT NULL,
  multiplier    numeric(4,2) NOT NULL CHECK (multiplier > 0),
  confidence    numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source        text NOT NULL DEFAULT 'ml-service',
  reason        text,
  model_version text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (window_end > window_start),
  UNIQUE (zone_id, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS zone_demand_lookup_idx ON zone_demand (zone_id, window_start, window_end);

-- ------------------------------------------------------------------ otp codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  purpose     text NOT NULL DEFAULT 'login',
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_phone_idx ON otp_codes (phone, created_at DESC);

-- --------------------------------------------------------------- refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_user_idx ON refresh_tokens (user_id);

-- -------------------------------------------------------------------- reports
-- Issues raised by pilgrims against a booking, triaged by admins.
CREATE TABLE IF NOT EXISTS reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  spot_id      uuid NOT NULL REFERENCES parking_spots (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category     text NOT NULL
               CHECK (category IN ('blocked_gate', 'overcharge', 'unsafe', 'wrong_location', 'dirty', 'other')),
  description  text NOT NULL,
  photo_url    text,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution   text,
  resolved_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_spot_idx ON reports (spot_id);

-- ------------------------------------------------------------------ audit logs
-- Every admin action and every money-affecting state transition lands here.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_role  text,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  reason      text,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs (actor_id, created_at DESC);
