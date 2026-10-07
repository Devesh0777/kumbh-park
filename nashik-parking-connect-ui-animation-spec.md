# Nashik Parking Connect — UI & Scroll Animation Spec

Reference language: Ola / Uber (map-first, bottom-sheet flows, single primary CTA).
Reference motion cues: subtle scroll-triggered reveals, pulsing live-status dots, smooth bottom-sheet transitions — not a heavy animation library, just well-placed motion.

No third-party "ThreeUI"-style package is used or required. Everything below is buildable with plain CSS + Intersection Observer, or Framer Motion if the team wants a helper library.

---

## 1. Design Tokens

| Token | Value | Notes |
|---|---|---|
| `--color-bg` | `#FAF7F2` | warm off-white, like the reference page |
| `--color-surface` | `#FFFFFF` | cards, sheets |
| `--color-text` | `#1A1A1A` | primary text |
| `--color-text-muted` | `#6B6B6B` | secondary text |
| `--color-accent` | `#D64545` | single accent color (booking CTAs, live/urgent states) |
| `--color-success` | `#2E7D46` | "Available" |
| `--color-warning` | `#D68A00` | "Filling Fast" |
| `--color-danger` | `#C62828` | "Full" |
| `--radius-card` | `16px` | |
| `--radius-sheet` | `20px 20px 0 0` | bottom sheets |
| `--font-heading` | Lexend / Inter, weight 600–700 | |
| `--font-body` | Inter, weight 400–500 | |
| `--shadow-card` | `0 2px 12px rgba(0,0,0,0.06)` | |
| `--shadow-sheet` | `0 -4px 24px rgba(0,0,0,0.12)` | |

Rule: **one accent color only**. Everything else is neutral. Status colors (success/warning/danger) are the only exceptions, used solely for availability pills.

---

## 2. Layout Patterns (Ola/Uber-style)

- **Map-first home/search screen**: map fills the viewport; search bar floats as a rounded pill at the top; results appear as a draggable bottom sheet over the map (not a separate page) on mobile, side panel on desktop.
- **Bottom sheet everywhere**: booking details, host listing form steps, filters — all open as bottom sheets rather than full page navigations, to keep context (map/list) visible underneath.
- **One primary CTA per screen**: a single full-width accent button anchored to the bottom safe area. Secondary actions are text links, never a second prominent button.
- **Cards**: rounded 16px corners, one photo (16:9), title + price + distance on one line, status pill top-right of the card.

---

## 3. Scroll & Motion Behavior

### 3.1 General rules
- Motion should clarify state changes (something became available, a sheet opened), never be decorative for its own sake.
- Standard easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo-ish) for anything entering the screen.
- Standard duration: 200–280ms for UI transitions, 400–600ms for content reveals.
- Respect `prefers-reduced-motion`: disable all scroll-triggered reveals and pulsing animations, keep only instant state changes.

### 3.2 Scroll-triggered reveal (landing page / host onboarding page)
Use for marketing/host-explainer sections only — not inside the core booking flow, which should feel instant.

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s cubic-bezier(0.22,1,0.36,1),
              transform 0.5s cubic-bezier(0.22,1,0.36,1);
}
.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target); // reveal once, don't re-trigger
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
```

Stagger children (e.g. a row of 3 feature cards) by adding `transition-delay: calc(var(--i) * 80ms)` where `--i` is set inline per card (0, 1, 2).

### 3.3 Bottom sheet transition
```css
.sheet {
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.22,1,0.36,1);
}
.sheet.open {
  transform: translateY(0);
}
```
Backdrop fades in over the same duration (`opacity 0 → 0.4` on a dark scrim). Sheet should be draggable-to-dismiss on mobile (basic touch delta tracking, snap closed if dragged past 40% of its height).

### 3.4 Live status pill (pulsing dot)
Used for "Filling Fast" and any live-occupancy indicator.
```css
.live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-warning);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(214,138,0,0.5); }
  70%  { box-shadow: 0 0 0 8px rgba(214,138,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(214,138,0,0); }
}
```
"Available" and "Full" pills are static (no animation) — pulsing is reserved for the urgency state only, so it doesn't lose meaning.

### 3.5 Map marker clustering (search screen)
- As the user zooms out, nearby spot markers merge into a cluster bubble showing a count (Uber/Ola-style).
- Transition: cluster bubbles scale in from 0.8 → 1 opacity/scale over 200ms when formed; individual markers fade out over 150ms as they merge.
- On zone-level zoom (e.g. viewing all of Ramkund), color-code clusters by aggregate availability (green = mostly open, amber = filling, red = mostly full) rather than showing a plain number.

### 3.6 Skeleton loading (not spinners)
Search results and listing details use skeleton placeholders (pulsing grey blocks matching final layout shape) instead of spinners, so the perceived load feels instant and layout doesn't jump.
```css
.skeleton {
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 4. Screen-by-screen motion notes

| Screen | Motion |
|---|---|
| Home/Search | Search pill has a subtle focus-scale (1 → 1.02) on tap; map pans smoothly (native map SDK easing) to results |
| Results list | Cards fade/slide in with 40ms stagger on first load only; no animation on subsequent scroll |
| Listing detail | Photo carousel: swipe with momentum, dot indicators crossfade |
| Booking sheet | Slides up per §3.3; confirm button shows a brief checkmark morph on success (not a full-screen modal) |
| Host listing form | Multi-step, each step slides horizontally (translateX) rather than the sheet re-opening |
| My Bookings | Status change (e.g. Confirmed → Checked-in) animates the pill color/text with a 150ms crossfade, not a re-render |

---

## 5. Maps — use a free/OpenStreetMap stack, not Google Maps

Since this is an event-driven, likely low-budget/community project, avoid Google Maps' paid API. Use an OpenStreetMap-based stack instead:

| Piece | Recommendation | Notes |
|---|---|---|
| Map tiles | **OpenStreetMap** tiles via a free tile provider (e.g. [MapTiler](https://www.maptiler.com/) free tier, [Stadia Maps](https://stadiamaps.com/) free tier, or self-hosted tiles) | Raw OSM tile servers (`tile.openstreetmap.org`) exist but their usage policy forbids production apps — use a proper free-tier provider or self-host instead of hitting raw OSM tiles directly |
| Map rendering library | **Leaflet.js** (lightweight, huge ecosystem, easiest to integrate with React via `react-leaflet`) or **MapLibre GL JS** (vector tiles, smoother zoom/rotation, better for the marker-clustering/zoom motion in §3.5) | Leaflet = simpler, faster to ship; MapLibre = better animation quality if you want the cluster color-coding to feel smooth |
| Marker clustering | `Leaflet.markercluster` plugin (if using Leaflet) or MapLibre's built-in GeoJSON clustering (if using MapLibre) | Both support custom cluster icons, needed for the green/amber/red aggregate-availability clusters in §3.5 |
| Geocoding / search-by-address | **Nominatim** (OSM's free geocoder) — self-host or use the public instance respectfully (low request volume, cache results) | Needed for "search by ghat/landmark name" on the home screen |
| Routing / distance-to-ghat | **OSRM** (Open Source Routing Machine, self-hostable) or **GraphHopper** free tier | Used to compute "distance from nearest ghat" shown on listing cards |

Practical note for this project specifically: since almost all searches will center on a handful of known Kumbh Mela zones (Ramkund, Trimbakeshwar, Nashik Road, Panchavati, Tapovan), you can pre-cache tiles and pre-compute ghat distances for that fixed set of zones — you don't need live global geocoding/routing at scale, which keeps the free-tier limits of Nominatim/OSRM comfortably sufficient even during Kumbh traffic spikes.

---

## 6. What NOT to do

- No parallax scrolling in the core app (fine for a marketing/landing page only, not in map or booking flows).
- No animated page-to-page transitions that delay task completion (booking a spot during a Kumbh crowd surge needs to feel instant, not cinematic).
- No third-party heavy animation/3D libraries for this app — it's a utility booking tool, not a visual showcase. Framer Motion (React) is the ceiling; no WebGL/Three.js needed anywhere in this product.
