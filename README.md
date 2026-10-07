# Nashik Parking Connect — Frontend

Mobile-first React app for finding and booking private parking during the Kumbh Mela, plus
host and admin surfaces. The UI follows the Ola/Uber pattern: map first, pill filters,
card lists, bottom sheets and a single primary CTA per screen.

Design, motion and map behaviour follow `nashik-parking-connect-ui-animation-spec.md`.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite 7 (`@vitejs/plugin-react`) |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), tokens in `src/index.css` |
| Data | Axios client with a swappable mock adapter |
| Map | Leaflet + `leaflet.markercluster` (imperative instance, no react-leaflet) |
| QR | `qrcode` package, rendered as a single SVG path |
| Lint | ESLint 9 flat config with the React Hooks recommended ruleset |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
npm run lint
```

## Mock mode (default)

`VITE_USE_MOCK=true` serves every screen from `src/api/mock/*` with realistic latency and
failure states, so the whole product works with no backend. All screens only talk to
`src/api/index.js`; nothing imports mock data directly (the one exception is the host
directory lookup, which is a static profile).

- `src/api/http.js` — axios instance, base URL, bearer token, friendly error mapping.
- `src/api/index.js` — public API surface; switches between mock and HTTP per `VITE_USE_MOCK`.
- `src/api/mock/` — zones, hosts, spots, reviews, plus mutable bookings, occupancy,
  verification submissions and reported issues.

To connect a real backend, set `VITE_USE_MOCK=false` and `VITE_API_BASE_URL`, then implement
the same exported function names in `src/api/index.js`.

## Map tiles

`src/config/map.js` resolves the tile URL. The default is the public OpenStreetMap raster
service, which is **development only** — the OSM tile usage policy does not allow production
traffic. For production set `VITE_TILE_PROVIDER` to `stadia`/`maptiler` with the matching key,
or paste a full XYZ template into `VITE_TILE_URL`.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Landing: zone picker, map preview, nearby spots, how-it-works, host CTA |
| `/search` | Map + result list, quick chips, filter sheet, marker/card selection |
| `/listing/:id` | Photo carousel, amenities, host card, reviews, mini-map, sticky CTA |
| `/bookings` | Active / upcoming / past passes with QR code and gate PIN |
| `/host` | Host dashboard: earnings, listings, bookings, check-in/out |
| `/host/new` | Six-step listing submission with animated stepper |
| `/admin` | Kumbh operations console: verification queue, occupancy, issues |

## Conventions

- Colours, radii, shadows, easings and type scale are CSS variables in `src/index.css`;
  utilities like `bg-surface`, `text-muted`, `card-shadow` map to them.
- Availability has one source of truth: `AVAILABILITY` in `src/lib/status.js`.
- Booking pricing is centralised in `quoteSummary` (`src/lib/id.js`); the sheet, listing and
  bookings screens all read from it.
- Async screens share `useAsync`, which owns loading/error/refetch and drives skeletons.
- Sheets use `Sheet` (bottom sheet on mobile, side panel from `lg`); `useSheetLock` handles
  scroll locking and Escape.
- Reveal-on-scroll is a single shared `IntersectionObserver` in `useReveal`; all motion is
  CSS and respects `prefers-reduced-motion`.
- `Photo` renders a deterministic generated SVG when no `src` is supplied, so the UI never
  shows a broken image before a backend exists.

## Verified

- `npm run lint` and `npm run build` pass.
- All routes smoke-tested in headless Chrome with zero console errors at 360px and 1440px.
- Book, waitlist, host check-in/out, admin approve/reject and issue-resolve flows exercised
  in the browser.
- Check-in QR output round-trip decoded successfully for payloads across versions 1–10.
