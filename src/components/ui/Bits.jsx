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

export function Avatar({ initials, size = 40, tone = 'accent', className }) {
  const tones = {
    accent: 'bg-accent-soft text-accent',
    dark: 'bg-text text-white',
    neutral: 'bg-surface-sunken text-muted',
  }
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold',
        tones[tone] ?? tones.accent,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {initials}
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
