import { query, withTransaction } from '../config/db.js'
import { ApiError } from '../lib/errors.js'
import { recordAudit } from '../middleware/error.js'
import { materialiseSlots, shapeSpot, SPOT_COLUMNS, hostFields } from './spots.service.js'

const SUBMISSION_SELECT = `
  SELECT ${SPOT_COLUMNS}, ${hostFields},
         (s.photos->0) AS cover_photo,
         s.review_notes,
         (SELECT json_build_object('id', z.id, 'name', z.name, 'slug', z.slug, 'mela_note', z.mela_note)
          FROM zones z WHERE z.id = s.zone_id) AS zone
  FROM parking_spots s
  JOIN zones z ON z.id = s.zone_id
  JOIN users u ON u.id = s.host_id`

/** GET /admin/spots/submissions - verification queue, oldest first. */
export const listSubmissions = async ({ status = 'pending', page = 1, pageSize = 20 } = {}) => {
  const { rows } = await query(
    `${SUBMISSION_SELECT}
     WHERE s.status = $1
     ORDER BY s.updated_at ASC
     LIMIT $2 OFFSET $3`,
    [status, pageSize, (page - 1) * pageSize],
  )
  const { rows: countRows } = await query('SELECT count(*)::int AS total FROM parking_spots WHERE status = $1', [status])
  return { items: rows.map((row) => ({ ...shapeSpot(row), reviewNotes: row.review_notes })), total: countRows[0].total }
}

/** POST /admin/spots/:id/verify - approve or reject a submission. */
export const decideSubmission = async (adminId, spotId, { decision, notes }, req) => {
  if (!['approved', 'rejected'].includes(decision)) {
    throw ApiError.badRequest('decision must be approved or rejected')
  }
  if (decision === 'rejected' && !notes) {
    throw ApiError.badRequest('Give the host a reason when rejecting')
  }

  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT id, status, host_id, title, capacity_2w, capacity_car, capacity_bus FROM parking_spots WHERE id = $1 FOR UPDATE',
      [spotId],
    )
    const existing = existingRows[0]
    if (!existing) throw ApiError.notFound('Submission not found')
    if (existing.status !== 'pending') {
      throw ApiError.badRequest(`This submission is already ${existing.status}`)
    }

    const nextStatus = decision === 'approved' ? 'verified' : 'rejected'
    const { rows } = await client.query(
      `UPDATE parking_spots
       SET status = $2, review_notes = $3, reviewed_at = now(), reviewed_by = $4,
           is_accepting = CASE WHEN $2 = 'verified' THEN true ELSE false END,
           updated_at = now()
       WHERE id = $1 RETURNING id, status, review_notes`,
      [spotId, nextStatus, notes ?? null, adminId],
    )

    // Bays only exist once a listing is approved.
    let slotsCreated = 0
    if (decision === 'approved') {
      slotsCreated = await materialiseSlots(client, spotId, {
        '2w': existing.capacity_2w,
        car: existing.capacity_car,
        bus: existing.capacity_bus,
      })
      // Verifying a host account is what unlocks listing creation for them.
      await client.query(
        `UPDATE users SET is_verified = true
         WHERE id = $1 AND role = 'host' AND is_verified = false`,
        [existing.host_id],
      )
    }

    await recordAudit(client, {
      actor: { id: adminId, role: 'admin' },
      action: `spot.${decision}`,
      entityType: 'parking_spot',
      entityId: spotId,
      before: { status: existing.status },
      after: { status: nextStatus, notes: notes ?? null, slotsCreated },
      reason: notes,
      req,
    })
    return { id: spotId, ...rows[0], slotsCreated }
  })
}

/** POST /admin/hosts/:id/suspend - suspend or reinstate a user. */
export const setUserSuspension = async (adminId, userId, { suspended, reason }, req) => {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query('SELECT id, role, is_suspended FROM users WHERE id = $1 FOR UPDATE', [
      userId,
    ])
    const existing = existingRows[0]
    if (!existing) throw ApiError.notFound('User not found')
    if (String(userId) === String(adminId)) throw ApiError.badRequest('You cannot suspend your own account')
    if (suspended && !reason) throw ApiError.badRequest('Give a reason when suspending')

    const { rows } = await client.query(
      `UPDATE users SET is_suspended = $2, suspended_reason = $3, updated_at = now()
       WHERE id = $1
       RETURNING id, phone, name, role, is_suspended, suspended_reason`,
      [userId, suspended, suspended ? reason : null],
    )
    if (suspended) {
      // Kill every active session immediately.
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId])
    }
    await recordAudit(client, {
      actor: { id: adminId, role: 'admin' },
      action: suspended ? 'user.suspend' : 'user.reinstate',
      entityType: 'user',
      entityId: userId,
      before: { isSuspended: existing.is_suspended },
      after: { isSuspended: suspended, reason: reason ?? null },
      reason,
      req,
    })
    return rows[0]
  })
}

/** GET /admin/occupancy - live board derived from confirmed bookings. */
export const getOccupancy = async ({ zone } = {}) => {
  const { rows } = await query(
    `SELECT z.id AS zone_id, z.name AS zone_name, z.slug,
            count(DISTINCT s.id)::int AS spots,
            COALESCE(sum(s.capacity_2w + s.capacity_car + s.capacity_bus), 0)::int AS bays_total,
            COALESCE(sum(s.capacity_2w + s.capacity_car + s.capacity_bus) FILTER (WHERE s.is_accepting), 0)::int AS bays_open,
            (SELECT count(*)::int FROM bookings b
              JOIN parking_spots bs ON bs.id = b.spot_id
              WHERE bs.zone_id = z.id AND b.status = 'checked_in')::int AS checked_in,
            (SELECT count(*)::int FROM bookings b
              JOIN parking_spots bs ON bs.id = b.spot_id
              WHERE bs.zone_id = z.id AND b.status = 'confirmed'
                AND b.time_window && tstzrange(now(), now() + interval '1 hour'))::int AS next_hour
     FROM zones z
     LEFT JOIN parking_spots s ON s.zone_id = z.id AND s.status = 'verified'
     WHERE ($1::text IS NULL OR z.id = $1::text)
     GROUP BY z.id, z.name, z.slug
     ORDER BY z.sort_order`,
    [zone ?? null],
  )

  return rows.map((row) => {
    const total = Number(row.bays_total)
    const busy = Number(row.checked_in)
    return {
      zone: { id: row.zone_id, name: row.zone_name, slug: row.slug },
      spots: row.spots,
      baysTotal: total,
      baysOpen: Number(row.bays_open),
      checkedIn: busy,
      bookedNextHour: Number(row.next_hour),
      occupancyPct: total > 0 ? Math.round((busy / total) * 100) : 0,
    }
  })
}

/** GET /admin/issues - reported problems with their resolution state. */
export const listIssues = async ({ status = 'open', page = 1, pageSize = 20 } = {}) => {
  const { rows } = await query(
    `SELECT r.id, r.booking_id, r.spot_id, r.category, r.description, r.photo_url,
            r.status, r.resolution, r.resolved_at, r.created_at,
            u.name AS reporter_name, u.phone AS reporter_phone,
            s.title AS spot_title
     FROM reports r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN parking_spots s ON s.id = r.spot_id
     WHERE ($1::text = 'all' OR r.status = $1)
     ORDER BY (r.status = 'open') DESC, r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status, pageSize, (page - 1) * pageSize],
  )
  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total FROM reports WHERE ($1::text = 'all' OR status = $1)`,
    [status],
  )
  return {
    items: rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      spotId: row.spot_id,
      spotTitle: row.spot_title,
      category: row.category,
      description: row.description,
      photoUrl: row.photo_url,
      status: row.status,
      resolution: row.resolution,
      resolvedAt: row.resolved_at,
      reporter: { name: row.reporter_name, phone: row.reporter_phone },
      createdAt: row.created_at,
    })),
    total: countRows[0].total,
  }
}

/** POST /admin/issues/:id/resolve - close an issue with a note. */
export const resolveIssue = async (adminId, issueId, { resolution }, req) => {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query('SELECT id, status FROM reports WHERE id = $1 FOR UPDATE', [issueId])
    const existing = existingRows[0]
    if (!existing) throw ApiError.notFound('Issue not found')
    if (existing.status === 'resolved') throw ApiError.badRequest('Issue is already resolved')

    const { rows } = await client.query(
      `UPDATE reports SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = now(), updated_at = now()
       WHERE id = $1 RETURNING id, status, resolution, resolved_at`,
      [issueId, resolution ?? null, adminId],
    )
    await recordAudit(client, {
      actor: { id: adminId, role: 'admin' },
      action: 'issue.resolve',
      entityType: 'report',
      entityId: issueId,
      before: { status: existing.status },
      after: { status: 'resolved', resolution },
      req,
    })
    return rows[0]
  })
}

/** GET /admin/analytics - headline numbers for the admin dashboard. */
export const getAnalytics = async () => {
  const { rows } = await query(`
    SELECT
      (SELECT count(*)::int FROM parking_spots WHERE status = 'pending')                     AS pending_submissions,
      (SELECT count(*)::int FROM parking_spots WHERE status = 'verified')                    AS live_spots,
      (SELECT count(*)::int FROM users WHERE role = 'pilgrim')                               AS pilgrims,
      (SELECT count(*)::int FROM users WHERE role = 'host')                                  AS hosts,
      (SELECT count(*)::int FROM bookings WHERE start_time::date = current_date)             AS bookings_today,
      (SELECT count(*)::int FROM bookings WHERE status = 'checked_in')                       AS active_now,
      (SELECT COALESCE(sum(amount), 0) FROM bookings
         WHERE status IN ('confirmed','checked_in','completed'))                            AS gross_revenue,
      (SELECT COALESCE(sum(platform_fee), 0) FROM bookings
         WHERE status IN ('confirmed','checked_in','completed'))                            AS platform_revenue,
      (SELECT COALESCE(avg(rating), 0)::float FROM reviews)                                  AS avg_rating,
      (SELECT count(*)::int FROM reports WHERE status = 'open')                              AS open_issues
  `)
  const { rows: trend } = await query(`
    SELECT d::date AS day,
           count(*) FILTER (WHERE s.start_time::date = d::date)::int AS bookings,
           COALESCE(sum(s.amount) FILTER (WHERE s.start_time::date = d::date), 0) AS revenue
    FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d
    LEFT JOIN bookings s ON s.status IN ('confirmed','checked_in','completed')
    GROUP BY d ORDER BY d
  `)
  return {
    ...rows[0],
    trend: trend.map((t) => ({ date: t.day, bookings: t.bookings, revenue: Number(t.revenue) })),
  }
}

/** GET /admin/audit-logs - the immutable admin trail. */
export const listAuditLogs = async ({ entityType, entityId, actorId, page = 1, pageSize = 50 } = {}) => {
  const clauses = []
  const params = []
  const add = (value) => {
    params.push(value)
    return `$${params.length}`
  }
  if (entityType) clauses.push(`al.entity_type = ${add(entityType)}`)
  if (entityId) clauses.push(`al.entity_id = ${add(entityId)}`)
  if (actorId) clauses.push(`al.actor_id = ${add(actorId)}`)

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  params.push(pageSize, (page - 1) * pageSize)

  const { rows } = await query(
    `SELECT al.id, al.actor_id, al.actor_role, al.action, al.entity_type, al.entity_id,
            al.before, al.after, al.reason, al.ip, al.created_at, u.name AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  return rows.map((row) => ({
    id: row.id,
    actor: { id: row.actor_id, name: row.actor_name, role: row.actor_role },
    action: row.action,
    entity: { type: row.entity_type, id: row.entity_id },
    before: row.before,
    after: row.after,
    reason: row.reason,
    ip: row.ip,
    createdAt: row.created_at,
  }))
}

/** GET /admin/payouts - queue for marking payouts as paid out. */
export const listPayouts = async ({ status = 'pending' } = {}) => {
  const { rows } = await query(
    `SELECT p.id, p.amount, p.status, p.paid_at, p.created_at,
            b.id AS booking_id, b.start_time, b.end_time, b.vehicle_number,
            s.title AS spot_title, u.name AS host_name, u.upi_id
     FROM host_payouts p
     JOIN bookings b ON b.id = p.booking_id
     JOIN parking_spots s ON s.id = b.spot_id
     JOIN users u ON u.id = p.host_id
     WHERE ($1::text = 'all' OR p.status = $1)
     ORDER BY p.created_at ASC`,
    [status],
  )
  return rows.map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    amount: Number(row.amount),
    status: row.status,
    host: { name: row.host_name, upiId: row.upi_id },
    booking: { start: row.start_time, end: row.end_time, vehicleNumber: row.vehicle_number, spotTitle: row.spot_title },
    paidAt: row.paid_at,
  }))
}

export const markPayoutPaid = async (adminId, payoutId, req) => {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query('SELECT id, status, amount FROM host_payouts WHERE id = $1 FOR UPDATE', [
      payoutId,
    ])
    const existing = existingRows[0]
    if (!existing) throw ApiError.notFound('Payout not found')
    if (existing.status === 'paid') throw ApiError.badRequest('Payout is already marked paid')

    const { rows } = await client.query(
      `UPDATE host_payouts SET status = 'paid', paid_at = now() WHERE id = $1 RETURNING id, status, amount, paid_at`,
      [payoutId],
    )
    await recordAudit(client, {
      actor: { id: adminId, role: 'admin' },
      action: 'payout.paid',
      entityType: 'host_payout',
      entityId: payoutId,
      before: { status: existing.status },
      after: { status: 'paid', amount: Number(existing.amount) },
      req,
    })
    return rows[0]
  })
}
