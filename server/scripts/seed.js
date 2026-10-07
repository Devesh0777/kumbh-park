import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { close, withTransaction } from '../src/config/db.js'
import { logger } from '../src/lib/logger.js'
import { migrate } from './migrate.js'
import { sha256 } from '../src/lib/crypto.js'

/**
 * Idempotent demo seed. Zones, users and spots are keyed by natural columns so
 * re-running updates in place instead of duplicating. Safe to run repeatedly.
 */

const ZONES = [
  {
    id: 'ramkund',
    name: 'Ramkund',
    slug: 'ramkund',
    mela_note: 'Shahi Snan ghats. Extremely tight during the main aarti.',
    latitude: 19.9975,
    longitude: 73.3118,
    demand_tag: 'surge',
    sort_order: 1,
  },
  {
    id: 'sadashiv-gaon',
    name: 'Sadashiv Gaon',
    slug: 'sadashiv-gaon',
    mela_note: 'Paid parking is common, mostly for cars and buses.',
    latitude: 19.9902,
    longitude: 73.3155,
    demand_tag: 'high',
    sort_order: 2,
  },
  {
    id: 'karanji',
    name: 'Karanji Park',
    slug: 'karanji-park',
    mela_note: 'Big open ground near the bus stand, good for buses and tempos.',
    latitude: 20.0031,
    longitude: 73.3079,
    demand_tag: 'normal',
    sort_order: 3,
  },
  {
    id: 'doodsangli',
    name: 'Doodsangli',
    slug: 'doodsangli',
    mela_note: 'Bridge approach from the Pune side. Watch the toll queue.',
    latitude: 20.0085,
    longitude: 73.3212,
    demand_tag: 'low',
    sort_order: 4,
  },
  {
    id: 'ambad',
    name: 'Ambad Link Road',
    slug: 'ambad-link-road',
    mela_note: 'Mela shuttle corridor, heavy two-wheeler traffic.',
    latitude: 19.9815,
    longitude: 73.3288,
    demand_tag: 'high',
    sort_order: 5,
  },
]

const USERS = [
  { phone: '+919800000001', name: 'Kumbh Ops', role: 'admin', verified: true, upi: 'kumbhops@upi' },
  { phone: '+919800000002', name: 'Suresh Patil', role: 'host', verified: true, upi: 'sureshpatil@upi', since: '2021-06-01' },
  { phone: '+919800000003', name: 'Anita Deshmukh', role: 'host', verified: true, upi: 'anitad@upi', since: '2023-01-15' },
  { phone: '+919800000004', name: 'Ravi Joshi', role: 'host', verified: false, upi: 'ravijoshi@upi' },
  { phone: '+919810000001', name: 'Priya Sharma', role: 'pilgrim', verified: true },
  { phone: '+919810000002', name: 'Mahesh Kulkarni', role: 'pilgrim', verified: true },
]

const SPOTS = [
  {
    key: 's1',
    host: '+919800000002',
    zone: 'ramkund',
    title: 'Gangapur Road Open Plot',
    description: 'Flat open plot 400m from Ramkund ghat. Level ground, easy in and out.',
    address: 'Gangapur Road, near Ramkund',
    landmark: 'Opposite the shahi aarti viewing point',
    latitude: 19.9971,
    longitude: 73.3131,
    capacity: { '2w': 40, car: 25, bus: 4 },
    pricePerHour: 30,
    pricePerDay: 250,
    minHours: 1,
    maxHours: 48,
    features: ['covered', 'security', 'washroom', 'water'],
    surface: 'paved',
    clearanceM: 4.5,
    gate: 'Enter from the north gate beside the tea stall. Show the QR at the gate.',
    checkInFrom: '05:00',
    checkOutBy: '23:00',
    status: 'verified',
    photos: [
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=1200',
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200',
    ],
  },
  {
    key: 's2',
    host: '+919800000003',
    zone: 'ramkund',
    title: 'Tilak Road Side Yard',
    description: 'Narrow but shaded yard behind a residential building. Best for cars.',
    address: 'Tilak Road, Ramkund',
    landmark: 'Blue gate opposite the post office',
    latitude: 19.9962,
    longitude: 73.3096,
    capacity: { '2w': 15, car: 12, bus: 0 },
    pricePerHour: 45,
    pricePerDay: 380,
    minHours: 1,
    maxHours: 24,
    features: ['cctv', 'security', 'shaded'],
    surface: 'paved',
    clearanceM: 3.0,
    gate: 'Single gate, 3m wide. Two-wheelers enter from the left.',
    checkInFrom: '06:00',
    checkOutBy: '22:00',
    status: 'verified',
    photos: ['https://images.unsplash.com/photo-1503428593586-e225b39bddfe?w=1200'],
  },
  {
    key: 's3',
    host: '+919800000002',
    zone: 'sadashiv-gaon',
    title: 'Shivaji Nagar Community Ground',
    description: 'Municipal community ground rented for the mela. Long term and day parking.',
    address: 'Shivaji Nagar, Sadashiv Gaon',
    landmark: 'Next to the community hall',
    latitude: 19.9908,
    longitude: 73.3161,
    capacity: { '2w': 60, car: 45, bus: 12 },
    pricePerHour: 25,
    pricePerDay: 210,
    minHours: 2,
    maxHours: 72,
    features: ['covered', 'toilet', 'water', 'lighting', 'security'],
    surface: 'paved',
    clearanceM: 5.0,
    gate: 'Main gate faces the road. Bus bays are at the far end.',
    checkInFrom: '05:00',
    checkOutBy: '23:30',
    status: 'verified',
    photos: [
      'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=1200',
      'https://images.unsplash.com/photo-1595556121989-0d4b3a0b0b0a?w=1200',
    ],
  },
  {
    key: 's4',
    host: '+919800000003',
    zone: 'karanji',
    title: 'Karanji Park South Lawn',
    description: 'Huge lawn by the bus stand. The practical choice for buses and tempos.',
    address: 'Karanji Park, south entrance',
    landmark: '200m from Karanji bus stand',
    latitude: 20.0025,
    longitude: 73.3092,
    capacity: { '2w': 30, car: 40, bus: 20 },
    pricePerHour: 20,
    pricePerDay: 160,
    minHours: 2,
    maxHours: 72,
    features: ['open', 'lighting', 'water', 'bus_bays'],
    surface: 'grass',
    clearanceM: 6.0,
    gate: 'South gate, follow the barricades. Bus bays marked in yellow.',
    checkInFrom: '05:00',
    checkOutBy: '23:00',
    status: 'verified',
    photos: ['https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200'],
  },
  {
    key: 's5',
    host: '+919800000003',
    zone: 'doodsangli',
    title: 'Doodsangi Bridge Approach Lot',
    description: 'Hard surfaced lot on the bridge approach. Best value, fills up by 9am.',
    address: 'Doodsangli approach road',
    landmark: 'Before the bridge, right side',
    latitude: 20.0071,
    longitude: 73.3201,
    capacity: { '2w': 50, car: 30, bus: 6 },
    pricePerHour: 20,
    pricePerDay: 150,
    minHours: 1,
    maxHours: 24,
    features: ['open', 'lighting'],
    surface: 'paved',
    clearanceM: 4.0,
    gate: 'Open access, attendant will guide you.',
    checkInFrom: '05:00',
    checkOutBy: '22:00',
    status: 'verified',
    photos: ['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200'],
  },
  {
    key: 's6',
    host: '+919800000004',
    zone: 'ambad',
    title: 'Ambad Link Road Two-Wheeler Stand',
    description: 'Newly listed, waiting on admin verification.',
    address: 'Ambad Link Road, near Mela Chowk',
    landmark: 'Next to the petrol pump',
    latitude: 19.9822,
    longitude: 73.3272,
    capacity: { '2w': 80, car: 10, bus: 0 },
    pricePerHour: 15,
    pricePerDay: 100,
    minHours: 1,
    maxHours: 24,
    features: ['open'],
    surface: 'paved',
    clearanceM: 3.5,
    gate: 'Open access.',
    checkInFrom: '05:00',
    checkOutBy: '23:00',
    status: 'pending',
    photos: ['https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200'],
  },
]

async function seedZones(client) {
  for (const zone of ZONES) {
    await client.query(
      `INSERT INTO zones (id, name, slug, mela_note, latitude, longitude, demand_tag, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, mela_note = EXCLUDED.mela_note, latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude, demand_tag = EXCLUDED.demand_tag, sort_order = EXCLUDED.sort_order`,
      [zone.id, zone.name, zone.slug, zone.mela_note, zone.latitude, zone.longitude, zone.demand_tag, zone.sort_order],
    )
  }
  logger.info({ zones: ZONES.length }, 'zones seeded')
}

async function seedUsers(client) {
  const ids = new Map()
  for (const user of USERS) {
    const { rows } = await client.query(
      `INSERT INTO users (phone, name, role, is_verified, host_since, upi_id, response_time, rating, rating_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
       RETURNING id`,
      [
        user.phone,
        user.name,
        user.role,
        user.verified,
        user.since ?? null,
        user.upi ?? null,
        user.role === 'host' ? 'within an hour' : null,
        user.role === 'host' ? 4.6 : null,
        user.role === 'host' ? 18 : 0,
      ],
    )
    ids.set(user.phone, rows[0].id)
  }
  logger.info({ users: USERS.length }, 'users seeded')
  return ids
}

async function seedSpots(client, userIds) {
  for (const spot of SPOTS) {
    const { rows: existingRows } = await client.query('SELECT id FROM parking_spots WHERE title = $1 AND host_id = $2', [
      spot.title,
      userIds.get(spot.host),
    ])
    let spotId
    if (existingRows.length) {
      spotId = existingRows[0].id
      await client.query(
        `UPDATE parking_spots SET
           zone_id = $2, description = $3, address = $4, landmark = $5, latitude = $6, longitude = $7,
           capacity_2w = $8, capacity_car = $9, capacity_bus = $10, price_per_hour = $11, price_per_day = $12,
           min_booking_hours = $13, max_booking_hours = $14, features = $15::jsonb, surface = $16,
           clearance_m = $17, gate_instructions = $18, check_in_from = $19, check_out_by = $20,
           photos = $21::jsonb, status = $22, is_accepting = true, updated_at = now()
         WHERE id = $1`,
        [
          spotId,
          spot.zone,
          spot.description,
          spot.address,
          spot.landmark,
          spot.latitude,
          spot.longitude,
          spot.capacity['2w'],
          spot.capacity.car,
          spot.capacity.bus,
          spot.pricePerHour,
          spot.pricePerDay,
          spot.minHours,
          spot.maxHours,
          JSON.stringify(spot.features),
          spot.surface,
          spot.clearanceM,
          spot.gate,
          spot.checkInFrom,
          spot.checkOutBy,
          JSON.stringify(spot.photos),
          spot.status,
        ],
      )
    } else {
      const { rows } = await client.query(
        `INSERT INTO parking_spots (
           host_id, zone_id, title, description, address, landmark, latitude, longitude,
           capacity_2w, capacity_car, capacity_bus, price_per_hour, price_per_day,
           min_booking_hours, max_booking_hours, features, surface, clearance_m,
           gate_instructions, check_in_from, check_out_by, photos, status,
           availability_windows, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22::jsonb,$23,$24::jsonb,now())
         RETURNING id`,
        [
          userIds.get(spot.host),
          spot.zone,
          spot.title,
          spot.description,
          spot.address,
          spot.landmark,
          spot.latitude,
          spot.longitude,
          spot.capacity['2w'],
          spot.capacity.car,
          spot.capacity.bus,
          spot.pricePerHour,
          spot.pricePerDay,
          spot.minHours,
          spot.maxHours,
          JSON.stringify(spot.features),
          spot.surface,
          spot.clearanceM,
          spot.gate,
          spot.checkInFrom,
          spot.checkOutBy,
          JSON.stringify(spot.photos),
          spot.status,
          JSON.stringify([{ days: [0, 1, 2, 3, 4, 5, 6], from: spot.checkInFrom, to: spot.checkOutBy }]),
        ],
      )
      spotId = rows[0].id
    }

    // Bays exist for every listing, but only verified ones are bookable. Seeding
    // them for pending listings too keeps the approve flow idempotent.
    await materialiseSeedSlots(client, spotId, spot.capacity)
  }
  logger.info({ spots: SPOTS.length }, 'spots and bays seeded')
}

async function materialiseSeedSlots(client, spotId, capacity) {
  for (const [vehicleType, count] of [
    ['2w', capacity['2w']],
    ['car', capacity.car],
    ['bus', capacity.bus],
  ]) {
    for (let i = 1; i <= Number(count ?? 0); i += 1) {
      await client.query(
        `INSERT INTO slots (spot_id, vehicle_type, code) VALUES ($1,$2,$3)
         ON CONFLICT (spot_id, code) DO NOTHING`,
        [spotId, vehicleType, `${vehicleType.toUpperCase()}-${String(i).padStart(2, '0')}`],
      )
    }
  }
}

async function seedDemoState(client, userIds) {
  // One surge window on Ramkund so the surge UI has something to render, and a
  // completed booking with a review so the ratings surfaces are not empty.
  const { rows: existingDemand } = await client.query('SELECT 1 FROM zone_demand WHERE zone_id = $1 LIMIT 1', ['ramkund'])
  if (!existingDemand.length) {
    await client.query(
      `INSERT INTO zone_demand (zone_id, window_start, window_end, multiplier, reason, source, model_version)
       VALUES ('ramkund', now(), now() + interval '3 days', 1.5,
               'Shahi Snan expected: heavy Ramkund footfall', 'ml-service', 'seed')`,
    )
  }

  const pilgrim = userIds.get('+919810000001')
  const { rows: spotRows } = await client.query("SELECT id FROM parking_spots WHERE title = 'Gangapur Road Open Plot'")
  if (!spotRows.length) return
  const spotId = spotRows[0].id

  const { rows: slotRows } = await client.query(
    "SELECT id FROM slots WHERE spot_id = $1 AND vehicle_type = 'car' AND is_currently_available ORDER BY code LIMIT 1",
    [spotId],
  )
  if (!slotRows.length) return

  const { rows: bookingRows } = await client.query('SELECT 1 FROM bookings WHERE spot_id = $1 LIMIT 1', [spotId])
  if (bookingRows.length) return

  const start = new Date(Date.now() - 3 * 3_600_000)
  const end = new Date(Date.now() - 1 * 3_600_000)
  const base = 30 * 2
  const fee = (base * 12) / 100

  const { rows } = await client.query(
    `INSERT INTO bookings (
       code, user_id, spot_id, slot_id, vehicle_type, vehicle_number,
       start_time, end_time, hours, pricing_plan, base_amount, surge_multiplier,
       surge_applied, surge_amount, platform_fee, amount, status,
       check_in_pin_hash, checked_in_at, checked_out_at)
     VALUES ('NPC-DEMO01',$1,$2,$3,'car','MH15AB1234',$4::timestamptz,$5::timestamptz,2,'hourly',$6,1,false,0,$7,$8,
             'completed',$9,$4::timestamptz,$5::timestamptz)
     RETURNING id`,
    [pilgrim, spotId, slotRows[0].id, start.toISOString(), end.toISOString(), base, fee, base + fee, sha256('000000')],
  )

  await client.query(
    `INSERT INTO reviews (booking_id, spot_id, user_id, rating, comment)
     VALUES ($1,$2,$3,5,'Very easy to find and the gate staff were helpful.') ON CONFLICT (booking_id) DO NOTHING`,
    [rows[0].id, spotId, pilgrim],
  )
  await client.query('UPDATE parking_spots SET rating = 5, review_count = 1 WHERE id = $1', [spotId])
  await client.query(
    `INSERT INTO host_payouts (host_id, booking_id, amount, platform_fee, status)
     VALUES ((SELECT host_id FROM parking_spots WHERE id = $1), $2, $3, $4, 'pending')
     ON CONFLICT (booking_id) DO NOTHING`,
    [spotId, rows[0].id, base, fee],
  )
  logger.info('demo booking, review, payout and surge window seeded')
}

export async function seed() {
  await withTransaction(async (client) => {
    await seedZones(client)
    const userIds = await seedUsers(client)
    await seedSpots(client, userIds)
    await seedDemoState(client, userIds)
  })
}

// True when this file is the process entrypoint (`node scripts/seed.js`).
const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isEntrypoint) {
  migrate()
    .then(seed)
    .then(() => logger.info('seed complete'))
    .catch((err) => {
      logger.error({ err: err.message }, 'seed failed')
      process.exitCode = 1
    })
    .finally(close)
}

