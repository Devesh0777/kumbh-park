import { cn } from '@/lib/cn'
import Icon from './Icon'

export function Rating({ value, reviews, size = 13, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', className)}>
      <Icon name="star" size={size} filled className="text-warning" />
      <span>{value != null ? Number(value).toFixed(1) : 'New'}</span>
      {reviews != null && <span className="font-normal text-muted">({reviews})</span>}
    </span>
  )
}

export function Avatar({ size = 40, tone = 'sage', className }) {
  const tones = {
    sage: 'bg-[#EAF2EC] text-[#006B4F] border border-[#006B4F]/20',
    cream: 'bg-[#FAF7F2] text-[#006B4F] border border-[#E2DDD3]',
    primary: 'bg-[#EAF2EC] text-[#006B4F] border border-[#006B4F]/25',
    dark: 'bg-[#17212B] text-white',
    neutral: 'bg-[#E2DDD3] text-[#17212B]',
    accent: 'bg-[#FFF5DF] text-[#B47C10] border border-[#E9A83A]/30',
  }
  const iconSize = Math.max(14, Math.round(size * 0.55))

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full overflow-hidden select-none transition-all shadow-2xs',
        tones[tone] ?? tones.sage,
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Human profile"
    >
      <svg
        viewBox="0 0 24 24"
        width={iconSize}
        height={iconSize}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 20.5v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1.5" />
        <circle cx="12" cy="7.5" r="3.75" />
      </svg>
    </span>
  )
}

export function VerifiedBadge({ label = 'Verified', size = 12 }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success">
      <Icon name="shield" size={size} strokeWidth={2} />
      {label}
    </span>
  )
}
