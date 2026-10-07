import { NavLink, Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import Icon from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Bits'
import { useApp } from '@/context/AppContext'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Find parking' },
  { to: '/bookings', label: 'My bookings' },
  { to: '/host', label: 'Host dashboard' },
  { to: '/admin', label: 'Admin' },
]

/** Desktop top bar — mirrors the mobile bottom nav (spec §2). */
export function TopNav() {
  const { user } = useApp()
  return (
    <header className="sticky top-0 z-[700] hidden border-b border-line bg-bg/90 backdrop-blur-sm lg:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-[15px] font-bold text-white">
            P
          </span>
          <span className="text-[15px] font-semibold">Nashik Parking Connect</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] text-muted">{user.name}</span>
          <Avatar initials={user.initials} size={30} tone="neutral" />
        </div>
      </div>
    </header>
  )
}

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
          isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-sunken hover:text-text',
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
        transparent ? 'bg-transparent' : 'border-b border-line bg-bg/92 backdrop-blur-sm',
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
          <h1 className="truncate text-[17px] font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-[12px] text-muted">{subtitle}</p>}
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
