import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import Icon from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Bits'
import { useApp } from '@/context/AppContext'
import LoginModal from '@/components/auth/LoginModal'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Find Parking' },
  { to: '/bookings', label: 'My Bookings' },
  { to: '/host', label: 'Host Dashboard' },
  { to: '/admin', label: 'Admin' },
]

/**
 * Redesigned Kumbh Park Global Navigation Bar
 * Authentic pilgrimage mobility infrastructure with Demo Role Switcher bar.
 */
export function TopNav() {
  const navigate = useNavigate()
  const { user, userRole, setUserRole } = useApp()
  const [showLoginModal, setShowLoginModal] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-[700] hidden border-b border-[#E2DDD3] bg-[#F7F3EA]/98 backdrop-blur-md lg:block">
        {/* TOP DEMO ROLE SWITCHER STRIP (PROTOTYPE FEATURE) */}
        <div className="bg-[#17212B] text-white text-[11px] font-mono px-5 py-1 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#E9A83A] animate-pulse" />
            <span className="font-bold text-[#FFD166] uppercase tracking-widest">
              PROTOTYPE DEMO MODE:
            </span>
            <span className="text-white/80">Switch view for presentation:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setUserRole('user', { name: 'Devv', id: 'u_devv' })
                navigate('/search')
              }}
              className={cn(
                'px-2.5 py-0.5 rounded font-bold uppercase transition-all cursor-pointer',
                userRole === 'user' ? 'bg-[#006B4F] text-white shadow-xs' : 'bg-white/10 text-white/70 hover:bg-white/20',
              )}
            >
              USER (Devv)
            </button>
            <button
              type="button"
              onClick={() => {
                setUserRole('host', { name: 'Sunita Deshmukh', id: 'h1' })
                navigate('/host')
              }}
              className={cn(
                'px-2.5 py-0.5 rounded font-bold uppercase transition-all cursor-pointer',
                userRole === 'host' ? 'bg-[#E9A83A] text-[#17212B] shadow-xs' : 'bg-white/10 text-white/70 hover:bg-white/20',
              )}
            >
              HOST
            </button>
            <button
              type="button"
              onClick={() => {
                setUserRole('admin', { name: 'Kumbh Controller', id: 'admin_1' })
                navigate('/admin')
              }}
              className={cn(
                'px-2.5 py-0.5 rounded font-bold uppercase transition-all cursor-pointer',
                userRole === 'admin' ? 'bg-[#8B2E21] text-white shadow-xs' : 'bg-white/10 text-white/70 hover:bg-white/20',
              )}
            >
              ADMIN
            </button>
          </div>
        </div>

        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          {/* Brand Logo & Lockup */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative grid size-8 place-items-center rounded-lg bg-[#006B4F] text-white border-1.5 border-white shadow-xs ring-1 ring-[#006B4F]/30 transition-transform group-hover:scale-105">
              <span className="font-mono text-[12px] font-black tracking-tight">KP</span>
              <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-[#E9A83A] border border-[#003822]" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-black tracking-tight text-[#17212B] font-heading">
                  Kumbh Park
                </span>
                <span className="rounded bg-[#EAF2EC] px-1.5 py-0.2 text-[8.5px] font-mono font-black text-[#006B4F] uppercase tracking-wider">
                  2027
                </span>
              </div>
              <p className="text-[9.5px] font-bold text-[#66706B] tracking-wider uppercase">
                Nashik–Trimbakeshwar Ghat Mobility
              </p>
            </div>
          </Link>

          {/* Cohesive Navigation Links */}
          <nav className="flex items-center gap-1">
            {LINKS.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          {/* Operational Scan QR + User Profile / Login Area */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-[#E2DDD3]">
            <Link
              to="/scan"
              className="flex items-center gap-1.5 rounded-lg border border-[#E2DDD3] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#17212B] hover:border-[#E9A83A] hover:bg-[#FFF5DF] transition-all shadow-2xs active:scale-95"
            >
              <Icon name="qr" size={13} className="text-[#006B4F]" />
              <span>Scan QR</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#EAF2EC] border border-[#006B4F]/30 px-2.5 py-1 text-[12px] font-bold text-[#17212B] hover:bg-[#006B4F] hover:text-white transition-all cursor-pointer"
            >
              <Avatar size={22} tone="sage" />
              <span>{user?.name || 'Devv'}</span>
              <span className="text-[9px] font-mono font-black text-[#006B4F] bg-white px-1 rounded uppercase">
                {userRole}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Login / Role Selection Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative px-3 py-1.5 text-[12.5px] font-bold rounded-lg transition-all duration-150',
          isActive
            ? 'text-[#006B4F] bg-[#EAF2EC] font-black after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#006B4F] after:rounded-full'
            : 'text-[#66706B] hover:text-[#17212B] hover:bg-[#FAF7F2]',
        )
      }
    >
      {label}
    </NavLink>
  )
}

/** Sticky screen header with optional back affordance and right-side actions. */
export function PageHeader({ title, subtitle, back = true, backTo, actions, transparent = false, className }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-[600] pt-safe',
        transparent ? 'bg-transparent' : 'border-b border-[#E8E1D6] bg-[#FAF7F2]/95 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        {back && (
          <Link
            to={backTo ?? -1}
            aria-label="Back"
            className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full text-text transition-colors hover:bg-surface-sunken"
          >
            <Icon name="chevronLeft" size={22} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold text-[#16191E]">{title}</h1>
          {subtitle && <p className="truncate text-[12px] text-[#6B6B6B]">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  )
}

/** Full-screen page wrapper: desktop top bar + safe bottom spacing. */
export function PageShell({ children, className }) {
  return (
    <div className="min-h-dvh bg-bg">
      <TopNav />
      <main className={cn('pb-20 lg:pb-8', className)}>{children}</main>
    </div>
  )
}
