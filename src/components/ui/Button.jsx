import { cn } from '@/lib/cn'

const VARIANTS = {
  primary:
    'bg-accent text-white shadow-[0_2px_10px_rgba(214,69,69,0.28)] hover:bg-accent-dark active:scale-[0.99] disabled:bg-accent/45 disabled:shadow-none',
  dark: 'bg-text text-white hover:bg-black active:scale-[0.99] disabled:bg-text/40',
  outline: 'border border-line bg-surface text-text hover:border-text/25 active:scale-[0.99]',
  ghost: 'text-text hover:bg-surface-sunken active:scale-[0.99]',
  soft: 'bg-accent-soft text-accent hover:bg-accent-soft/70 active:scale-[0.99]',
  neutral: 'bg-surface-sunken text-text hover:bg-line/70 active:scale-[0.99]',
}

const SIZES = {
  sm: 'h-9 px-3.5 text-[13px] rounded-[10px] gap-1.5',
  md: 'h-11 px-4 text-[14px] rounded-[12px] gap-2',
  lg: 'h-[52px] px-5 text-[15px] rounded-[14px] gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  icon = null,
  iconRight = null,
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-all duration-200 [transition-timing-function:var(--ease-out-expo)]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
      {iconRight}
    </button>
  )
}
