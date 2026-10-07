-- =============================================================================
-- Migration 002: QR Check-in/Check-out, Token Security & Extra-Time Billing
-- =============================================================================

-- 1. Parking QR Tokens Table
-- Tracks static, physical printed QR tokens per parking spot with audit history
CREATE TABLE IF NOT EXISTS parking_qr_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id      uuid NOT NULL REFERENCES parking_spots (id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  qr_token        text NOT NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  revoked_reason  text,
  created_by      uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parking_qr_tokens_parking_idx ON parking_qr_tokens (parking_id, revoked_at);
CREATE INDEX IF NOT EXISTS parking_qr_tokens_hash_idx ON parking_qr_tokens (token_hash);

-- 2. Extend Bookings Table
-- Ensure booking_status, payment_status, check_in_time, check_out_time, extra billing fields exist
DO $$
BEGIN
  -- check_in_time and check_out_time aliases / columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='check_in_time') THEN
    ALTER TABLE bookings ADD COLUMN check_in_time timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='check_out_time') THEN
    ALTER TABLE bookings ADD COLUMN check_out_time timestamptz;
  END IF;

  -- Sync with checked_in_at / checked_out_at if present
  UPDATE bookings SET check_in_time = checked_in_at WHERE check_in_time IS NULL AND checked_in_at IS NOT NULL;
  UPDATE bookings SET check_out_time = checked_out_at WHERE check_out_time IS NULL AND checked_out_at IS NOT NULL;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_paid') THEN
    ALTER TABLE bookings ADD COLUMN amount_paid numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0);
    UPDATE bookings SET amount_paid = amount WHERE amount_paid = 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='extra_amount') THEN
    ALTER TABLE bookings ADD COLUMN extra_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_amount >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='extra_hours') THEN
    ALTER TABLE bookings ADD COLUMN extra_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK (extra_hours >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_status') THEN
    ALTER TABLE bookings ADD COLUMN payment_status text NOT NULL DEFAULT 'PAID'
      CHECK (payment_status IN ('PAID', 'PENDING_EXTRA', 'COMPLETED', 'REFUNDED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='booking_status') THEN
    ALTER TABLE bookings ADD COLUMN booking_status text NOT NULL DEFAULT 'CONFIRMED'
      CHECK (booking_status IN ('CONFIRMED', 'ACTIVE', 'PENDING_EXTRA_PAYMENT', 'COMPLETED', 'NO_SHOW', 'CANCELLED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='needs_manual_review') THEN
    ALTER TABLE bookings ADD COLUMN needs_manual_review boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='manual_review_reason') THEN
    ALTER TABLE bookings ADD COLUMN manual_review_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='razorpay_extra_order_id') THEN
    ALTER TABLE bookings ADD COLUMN razorpay_extra_order_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='razorpay_extra_payment_id') THEN
    ALTER TABLE bookings ADD COLUMN razorpay_extra_payment_id text;
  END IF;
END
$$;

-- Sync initial booking_status based on status
UPDATE bookings SET booking_status = 'CONFIRMED' WHERE status = 'confirmed' AND booking_status IS NULL;
UPDATE bookings SET booking_status = 'ACTIVE' WHERE status = 'checked_in' AND booking_status IS NULL;
UPDATE bookings SET booking_status = 'COMPLETED' WHERE status = 'completed' AND booking_status IS NULL;
UPDATE bookings SET booking_status = 'CANCELLED' WHERE status = 'cancelled' AND booking_status IS NULL;

CREATE INDEX IF NOT EXISTS bookings_booking_status_idx ON bookings (booking_status);
CREATE INDEX IF NOT EXISTS bookings_check_in_time_idx ON bookings (check_in_time);
CREATE INDEX IF NOT EXISTS bookings_check_out_time_idx ON bookings (check_out_time);
