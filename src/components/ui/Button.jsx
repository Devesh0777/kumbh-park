import { cn } from '@/lib/cn'

const VARIANTS = {
  primary:
    'bg-[#E9A83A] text-[#17212B] font-bold shadow-sm hover:bg-[#DC9B2E] active:scale-[0.99] disabled:bg-[#E9A83A]/45 disabled:shadow-none',
  brand:
    'bg-[#006B4F] text-white font-bold shadow-sm hover:bg-[#00543E] active:scale-[0.99] disabled:bg-[#006B4F]/45 disabled:shadow-none',
  dark: 'bg-[#17212B] text-white hover:bg-black active:scale-[0.99] disabled:bg-[#17212B]/40',
  outline: 'border border-[#E2DDD3] bg-white text-[#17212B] hover:bg-[#FAF7F2] active:scale-[0.99]',
  ghost: 'text-[#17212B] hover:bg-[#FAF7F2] active:scale-[0.99]',
  soft: 'bg-[#FFF5DF] text-[#B47C10] hover:bg-[#FFEEC5] active:scale-[0.99]',
  softGreen: 'bg-[#EAF2EC] text-[#006B4F] hover:bg-[#DDECE0] active:scale-[0.99]',
  danger: 'bg-[#D96B5F] text-white font-bold hover:bg-[#C85B4F] active:scale-[0.99]',
  neutral: 'bg-[#FAF7F2] text-[#17212B] border border-[#E2DDD3] hover:bg-[#EAF2EC] active:scale-[0.99]',
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
