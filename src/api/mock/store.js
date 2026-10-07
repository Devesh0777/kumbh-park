import { seedBookings } from './bookings'
import { spots } from './spots'
import { currentHost } from './hosts'

/**
 * In-memory runtime state for mock mode. Everything the UI can mutate —
 * bookings, live occupancy, host listings, admin queue — lives here so the
 * app behaves like it has a backend while staying a single-page frontend.
 */
const H = 3600_000

const hostListingMeta = {
  s1: {
    verification: 'verified',
    published: true,
    accepting: true,
    earnings: 18400,
    cancelled: 3,
  },
  s12: {
    verification: 'verified',
    published: true,
    accepting: true,
    earnings: 22150,
    cancelled: 1,
  },
}

const state = {
  bookings: [...seedBookings],
  occupancy: Object.fromEntries(spots.map((s) => [s.id, s.spotsLeft])),
  waitlist: [
    { id: 'w1', spotId: 's3', name: 'Kavita N.', createdISO: new Date(Date.now() - 2 * H).toISOString() },
    { id: 'w2', spotId: 's20', name: 'Suresh P.', createdISO: new Date(Date.now() - 5 * H).toISOString() },
  ],
  hostListings: spots
    .filter((s) => s.hostId === currentHost.id)
    .map((s) => ({ spotId: s.id, ...hostListingMeta[s.id] })),
  submissions: [
    {
      id: 'sub1',
      hostName: 'Ganesh Wagh',
      phone: '+91 88xxx xxxxx',
      title: 'Shivaji Chowk edge plot',
      zoneId: 'ramkund',
      zoneName: 'Ramkund',
      address: 'Shivaji Chowk edge, Nashik Road',
      latlng: [19.9455, 73.3272],
      vehicles: ['2w'],
      capacity: 30,
      priceHour: 20,
      priceDay: 140,
      features: ['floodlight'],
      documents: ['Aadhaar (masked)', 'Property tax receipt'],
      submittedISO: new Date(Date.now() - 6 * H).toISOString(),
      status: 'pending',
      note: 'Owner has the plot on lease for the mela season.',
    },
    {
      id: 'sub2',
      hostName: 'Ramesh Bhosale',
      phone: '+91 94xxx xxxxx',
      title: 'School ground lease, Tapovan',
      zoneId: 'tapovan',
      zoneName: 'Tapovan',
      address: 'Tapovan Road, Near Old School',
      latlng: [19.9385, 73.6062],
      vehicles: ['2w', 'car', 'bus'],
      capacity: 45,
      priceHour: 30,
      priceDay: 190,
      features: ['floodlight', 'wide', 'water', 'caretaker'],
      documents: ['Trust letter', 'Aadhaar (masked)'],
      submittedISO: new Date(Date.now() - 19 * H).toISOString(),
      status: 'pending',
      note: 'Lease letter countersigned by the school trust.',
    },
    {
      id: 'sub3',
      hostName: 'Sneha Patil',
      phone: '+91 91xxx xxxxx',
      title: 'Nilkanth Society visitor bay',
      zoneId: 'panchavati',
      zoneName: 'Panchavati',
      address: 'Satpur Road, Nashik',
      latlng: [19.9882, 73.6435],
      vehicles: ['2w', 'car'],
      capacity: 16,
      priceHour: 28,
      priceDay: 180,
      features: ['covered', 'gate', 'cctv', 'caretaker'],
      documents: ['Society resolution'],
      submittedISO: new Date(Date.now() - 40 * H).toISOString(),
      status: 'pending',
      note: null,
    },
  ],
  issues: [
    {
      id: 'i1',
      type: 'Overstay',
      spotId: 's2',
      zoneName: 'Ramkund',
      title: 'Vehicle overstayed by 6 hours',
      detail: 'Bus parked since 04:00, still there at 21:30. Other vehicles had nowhere to go.',
      raisedBy: 'Imran Shaikh',
      raisedISO: new Date(Date.now() - 3 * H).toISOString(),
      status: 'open',
      severity: 'high',
    },
    {
      id: 'i2',
      type: 'Access',
      spotId: 's3',
      zoneName: 'Ramkund',
      title: 'Society gate closed before booking end time',
      detail: 'Booked till 18:00, gate was shut at 17:00 with cars still inside.',
      raisedBy: 'Kavita N.',
      raisedISO: new Date(Date.now() - 27 * H).toISOString(),
      status: 'in_review',
      severity: 'medium',
    },
    {
      id: 'i3',
      type: 'Photo mismatch',
      spotId: 's4',
      zoneName: 'Ramkund',
      title: 'Listed plot has different surface than photos',
      detail: 'Photos show tiles, actual plot is muddy gravel.',
      raisedBy: 'Nitin J.',
      raisedISO: new Date(Date.now() - 50 * H).toISOString(),
      status: 'resolved',
      severity: 'low',
    },
    {
      id: 'i4',
      type: 'Flooding',
      spotId: 's13',
      zoneName: 'Panchavati',
      title: 'Plot under water after evening rain',
      detail: 'Ghat road flooded, low-lying half of the plot unusable.',
      raisedBy: 'Auto-flag (weather)',
      raisedISO: new Date(Date.now() - 8 * H).toISOString(),
      status: 'open',
      severity: 'high',
    },
  ],
  waitlistNotifications: true,
}

export default state
