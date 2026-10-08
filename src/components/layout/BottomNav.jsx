import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import Icon from '@/components/ui/Icon'

const TABS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/scan', label: 'Scan QR', icon: 'qr', highlight: true },
  { to: '/bookings', label: 'Bookings', icon: 'ticket' },
  { to: '/host', label: 'Host', icon: 'wallet' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const hidden = pathname.startsWith('/listing/') || pathname.startsWith('/admin')

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-[800] border-t border-line bg-surface/95 backdrop-blur-sm',
        'pb-[max(0.25rem,env(safe-area-inset-bottom))] transition-transform duration-300',
        'lg:hidden',
        hidden && 'translate-y-full',
      )}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10px] font-bold transition-colors',
                  isActive ? 'text-[#006B4F]' : 'text-[#66706B] hover:text-[#17212B]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full transition-colors duration-200',
                      isActive ? 'bg-[#EAF2EC] text-[#006B4F]' : '',
                    )}
                  >
                    <Icon name={tab.icon} size={19} strokeWidth={isActive ? 2.3 : 1.8} />
                  </span>
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
