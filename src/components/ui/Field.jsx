import { cn } from '@/lib/cn'
import Icon from './Icon'

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-text">
        {label}
        {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-danger">
          <Icon name="alert" size={13} />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

const CONTROL =
  'w-full rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[14px] placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 transition-colors'

export function Input({ className, invalid, ...rest }) {
  return <input className={cn(CONTROL, invalid && 'border-danger', className)} {...rest} />
}

export function Textarea({ className, rows = 3, ...rest }) {
  return <textarea rows={rows} className={cn(CONTROL, 'resize-none', className)} {...rest} />
}

export function Select({ className, children, ...rest }) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, 'appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  )
}

/** iOS-style segmented option, used for vehicle type / plan pickers. */
export function OptionTile({ active, icon, title, subtitle, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left',
        'transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.99]',
        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-text/20',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            active ? 'bg-accent text-white' : 'bg-surface-sunken text-muted',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[12px] text-muted">{subtitle}</span>}
      </span>
      {active && <Icon name="checkCircle" size={18} className="shrink-0 text-accent" />}
    </button>
  )
}

export function Toggle({ checked, onChange, label, description, tone = 'accent' }) {
  const on = tone === 'accent' ? 'bg-accent' : 'bg-success'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 text-left"
    >
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? on : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] duration-200',
            '[transition-timing-function:var(--ease-out-expo)]',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
      {label && (
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold">{label}</span>
          {description && <span className="mt-0.5 block text-[12px] text-muted">{description}</span>}
        </span>
      )}
    </button>
  )
}
