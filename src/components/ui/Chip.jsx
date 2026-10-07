import { cn } from '@/lib/cn'
import Icon from './Icon'

/** Pill-shaped filter chip, Ola/Uber style. */
export default function Chip({
  active = false,
  icon = null,
  onClick,
  className,
  children,
  count,
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold',
        'transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.97]',
        active
          ? 'border-text bg-text text-white'
          : 'border-line bg-surface text-text hover:border-text/20',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {count != null && (
        <span
          className={cn(
            'ml-0.5 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-4',
            active ? 'bg-white/20' : 'bg-surface-sunken text-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/** Segmented control used for tabs (bookings, host, admin). */
export function SegmentedTabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface-sunken p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold',
              'transition-all duration-200 [transition-timing-function:var(--ease-out-expo)]',
              size === 'sm' ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2 text-[13px]',
              active ? 'bg-surface text-text card-shadow' : 'text-muted hover:text-text',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && (
              <span className={cn('text-[11px]', active ? 'text-accent' : 'text-muted/70')}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Text link used for secondary actions — never a second prominent button. */
export function TextLink({ icon, children, className, ...rest }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 text-[13px] font-semibold text-accent',
        'transition-opacity hover:opacity-75 active:opacity-60',
        className,
      )}
      {...rest}
    >
      {icon ?? <Icon name="chevronRight" size={14} />}
      {children}
    </button>
  )
}
