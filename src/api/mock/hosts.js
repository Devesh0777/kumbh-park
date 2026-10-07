export const hosts = [
  {
    id: 'h1',
    name: 'Sunita Deshmukh',
    initials: 'SD',
    rating: 4.9,
    reviews: 212,
    since: 2022,
    verified: true,
    responseTime: '~5 min',
    phone: '+91 98xxx xxxxx',
  },
  {
    id: 'h2',
    name: 'Imran Shaikh',
    initials: 'IS',
    rating: 4.7,
    reviews: 148,
    since: 2023,
    verified: true,
    responseTime: '~10 min',
    phone: '+91 97xxx xxxxx',
  },
  {
    id: 'h3',
    name: 'Anjali Pawar',
    initials: 'AP',
    rating: 4.6,
    reviews: 96,
    since: 2023,
    verified: true,
    responseTime: '~15 min',
    phone: '+91 99xxx xxxxx',
  },
  {
    id: 'h4',
    name: 'Vikas Jain',
    initials: 'VJ',
    rating: 4.8,
    reviews: 64,
    since: 2024,
    verified: true,
    responseTime: '~8 min',
    phone: '+91 96xxx xxxxx',
  },
  {
    id: 'h5',
    name: 'Ganesh Wagh',
    initials: 'GW',
    rating: 4.4,
    reviews: 41,
    since: 2024,
    verified: false,
    responseTime: '~1 hr',
    phone: '+91 88xxx xxxxx',
  },
  {
    id: 'h6',
    name: 'Meera Joshi',
    initials: 'MJ',
    rating: 5.0,
    reviews: 33,
    since: 2025,
    verified: true,
    responseTime: '~5 min',
    phone: '+91 90xxx xxxxx',
  },
]

export const hostById = (id) => hosts.find((h) => h.id === id)

/** The signed-in pilgrim (mock auth). */
export const currentUser = {
  id: 'u1',
  name: 'Rohit Kulkarni',
  initials: 'RK',
  phone: '+91 90xxx xxxxx',
  homeZone: 'ramkund',
}

/** The signed-in host (mock auth) — owns the listings in listings.js. */
export const currentHost = {
  id: 'h1',
  name: 'Sunita Deshmukh',
  initials: 'SD',
  rating: 4.9,
  reviews: 212,
  since: 2022,
  verified: true,
  phone: '+91 98xxx xxxxx',
}
