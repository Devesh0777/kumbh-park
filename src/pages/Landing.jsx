import { Link } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import PilgrimJourney from '@/components/home/PilgrimJourney'
import KumbhParkRoadHero from '@/components/home/KumbhParkRoadHero'

export default function Landing() {
  return (
    <PageShell>
      {/* ----------------- 1. HOMEPAGE HERO: "KUMBH PARK" AS STREET-MAP TYPOGRAPHY ----------------- */}
      <KumbhParkRoadHero />

      {/* ----------------- 2. INTERACTIVE WELCOME TO NASHIK PILGRIM ROAD JOURNEY ----------------- */}
      <PilgrimJourney />

      {/* ------------------------------ 7. FOOTER ----------------------------- */}
      <footer className="mt-16 border-t border-[#E8E1D6] bg-[#111923] px-4 pt-12 pb-24 text-center sm:pb-12 text-[#FAF7F2]">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-[#005A36] text-[14px] font-black font-mono text-white border border-white/40 shadow-sm">
                KP
              </div>
              <div className="text-left">
                <span className="text-[16px] font-black text-[#FAF7F2] font-heading">Kumbh Park</span>
                <p className="text-[11px] text-[#FAF7F2]/60">Kumbh Mela Smart Mobility Network 2027</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 text-[13px] font-bold text-[#FAF7F2]/80">
              <Link to="/search" className="hover:text-[#FFD166] transition-colors">
                Find Parking
              </Link>
              <Link to="/bookings" className="hover:text-[#FFD166] transition-colors">
                My Bookings & Passes
              </Link>
              <Link to="/host" className="hover:text-[#FFD166] transition-colors">
                Host Portal
              </Link>
              <Link to="/admin" className="hover:text-[#FFD166] transition-colors">
                Admin Console
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-[12px] text-[#FAF7F2]/60">
            <p>Dedicated Smart Mobility & Verified Private Parking System for Nashik-Trimbakeshwar Kumbh Mela.</p>
            <p className="mt-1 text-[11px] text-[#FAF7F2]/45">
              © {new Date().getFullYear()} Kumbh Park. All verified private parking listings comply with local traffic and
              municipal safety advisories.
            </p>
          </div>
        </div>
      </footer>
    </PageShell>
  )
}
