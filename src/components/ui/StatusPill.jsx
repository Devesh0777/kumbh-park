import { cn } from '@/lib/cn'
import { TONE_CLASS, TONE_DOT } from '@/lib/status'

/**
 * Status pill. Pulsing dot is reserved for the urgency state only
 * ("Filling Fast"), so the animation keeps its meaning — spec §3.4.
 */
export default function StatusPill({
  tone = 'neutral',
  label,
  dot = false,
  pulse = false,
  size = 'md',
  className,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        TONE_CLASS[tone] ?? TONE_CLASS.neutral,
        className,
      )}
    >
      {(dot || pulse) && (
        <span className="relative flex size-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex size-full animate-[pulse-dot_1.6s_ease-in-out_infinite] rounded-full',
                TONE_DOT[tone] ?? TONE_DOT.neutral,
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex size-1.5 rounded-full',
              pulse ? '' : TONE_DOT[tone] ?? TONE_DOT.neutral,
            )}
          />
        </span>
      )}
      {label}
    </span>
  )
}
