/**
 * The five mela zones the product is built around, plus the ghats used for
 * "distance from nearest ghat". Coordinates are approximate and good enough
 * for a mock map; swap for surveyed points when a real backend exists.
 */
export const zones = [
  {
    id: 'ramkund',
    name: 'Ramkund',
    short: 'Ramkund',
    latlng: [20.0074, 73.7925],
    blurb: 'Main pandal and Godavari sacred snan ghats. Zero parking within 1 km on peak days.',
    melaNote: 'Highest demand 06:00–11:00',
    tag: 'Most crowded',
    ghat: { name: 'Ramkund Kund', latlng: [20.0074, 73.7925] },
  },
  {
    id: 'trimbakeshwar',
    name: 'Trimbakeshwar',
    short: 'Trimbakeshwar',
    latlng: [19.932, 73.531],
    blurb: 'Kumbh Sthal at Brahmagiri and Kushavarta Kund.',
    melaNote: 'Best value, 28 km from Ramkund',
    tag: 'Best value',
    ghat: { name: 'Kushavarta Kund', latlng: [19.932, 73.531] },
  },
  {
    id: 'trimbak-road',
    name: 'Trimbakeshwar Road',
    short: 'Trimbak Rd',
    latlng: [19.972, 73.705],
    blurb: 'Highway approach road — spacious plots and compounds.',
    melaNote: 'Day parking popular with tour buses',
    tag: 'Bus friendly',
    ghat: { name: 'Someshwar Ghat', latlng: [20.03, 73.72] },
  },
  {
    id: 'nashik-road',
    name: 'Nashik Road',
    short: 'Nashik Rd',
    latlng: [19.954, 73.834],
    blurb: 'Rail head and Dharamsala hub. Long-stay parking for pilgrims arriving by train.',
    melaNote: 'Overnight demand 80%+',
    tag: 'Overnight',
    ghat: { name: 'Panchavati Ghat', latlng: [20.0065, 73.798] },
  },
  {
    id: 'panchavati',
    name: 'Panchavati',
    short: 'Panchavati',
    latlng: [20.0065, 73.798],
    blurb: 'Godavari ghats, Kalaram Mandir and Sita Gumpha.',
    melaNote: 'Prime riverfront access',
    tag: 'Riverside',
    ghat: { name: 'Panchavati Ghat', latlng: [20.0065, 73.798] },
  },
  {
    id: 'tapovan',
    name: 'Tapovan',
    short: 'Tapovan',
    latlng: [19.992, 73.818],
    blurb: 'Sadhu Gram and Tapovan ashrams. Wide compounds and sadhu camp staging.',
    melaNote: 'Steady pilgrim demand',
    tag: 'Quiet',
    ghat: { name: 'Kapila Sangam Ghat', latlng: [19.9984, 73.8143] },
  },
]

export const zoneById = (id) => zones.find((z) => z.id === id)

/** Every ghat point, for the "ghat" labels on the map. */
export const ghatPoints = [
  { name: 'Ramkund', latlng: [20.0074, 73.7925] },
  { name: 'Lakshminarayan Ghat', latlng: [20.0012, 73.8101] },
  { name: 'Panchavati', latlng: [20.0065, 73.798] },
  { name: 'Tapovan / Sadhu Gram', latlng: [19.992, 73.818] },
  { name: 'Kapila Sangam', latlng: [19.9984, 73.8143] },
  { name: 'Someshwar Ghat', latlng: [20.03, 73.72] },
  { name: 'Kushavarta Kund', latlng: [19.932, 73.531] },
  { name: 'Nashik Road Station', latlng: [19.954, 73.834] },
]
