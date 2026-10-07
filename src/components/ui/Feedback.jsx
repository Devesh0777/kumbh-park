import { cn } from '@/lib/cn'
import Icon from './Icon'

export function EmptyState({ icon = 'inbox', title, message, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-surface-sunken text-muted">
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      {message && <p className="mt-1 max-w-xs text-[13px] text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }) {
  return (
    <EmptyState
      icon="alert"
      title="Couldn't load this"
      message={message || 'Something went wrong. Pull to retry.'}
      className={className}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent"
          >
            <Icon name="refresh" size={15} />
            Try again
          </button>
        )
      }
    />
  )
}

/** Horizontal step progress for the multi-step host form. */
export function StepBar({ steps, current, className }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <div key={step.id ?? index} className="flex-1">
            <div
              className={cn(
                'h-1 rounded-full transition-colors duration-300 [transition-timing-function:var(--ease-out-expo)]',
                done || active ? 'bg-accent' : 'bg-line',
              )}
            />
            <p
              className={cn(
                'mt-1.5 truncate text-[11px] font-semibold transition-colors',
                active ? 'text-accent' : done ? 'text-muted' : 'text-muted/50',
              )}
            >
              {step.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
