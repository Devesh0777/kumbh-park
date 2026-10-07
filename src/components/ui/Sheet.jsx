import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { useSheetLock } from '@/hooks/useSheetLock'

const DISMISS_RATIO = 0.4

/**
 * Responsive modal dialog / bottom sheet:
 * - On mobile: Slides up gracefully from the bottom as a full-featured sheet with touch drag-to-dismiss.
 * - On tablet / desktop: Centered floating modal with crisp backdrop blur and generous scrollable area.
 */
export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  side = 'bottom',
  height = 'auto',
  hideClose = false,
  className,
}) {
  const panelRef = useRef(null)
  const drag = useRef({ active: false, startY: 0, delta: 0, height: 0 })
  useSheetLock(open)

  useEffect(() => {
    if (!open) return
    const onCloseEvent = () => onClose?.()
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('npc:close-sheets', onCloseEvent)
    window.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('npc:close-sheets', onCloseEvent)
      window.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  const onPointerDown = (event) => {
    if (!panelRef.current || window.innerWidth >= 768) return
    const rect = panelRef.current.getBoundingClientRect()
    drag.current = {
      active: true,
      startY: event.clientY,
      delta: 0,
      height: rect.height,
      pointerId: event.pointerId,
    }
    panelRef.current.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    if (!drag.current.active || !panelRef.current) return
    const delta = Math.max(0, event.clientY - drag.current.startY)
    drag.current.delta = delta
    panelRef.current.style.transform = `translateY(${delta}px)`
  }

  const onPointerUp = () => {
    if (!drag.current.active || !panelRef.current) return
    const { delta, height: h } = drag.current
    drag.current.active = false
    panelRef.current.style.transform = ''
    if (delta > h * DISMISS_RATIO) onClose?.()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end md:items-center md:justify-center p-0 md:p-6 animate-in fade-in duration-200">
      {/* Dark backdrop scrim with blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Sheet / Modal Panel */}
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 flex flex-col w-full bg-surface border border-line shadow-2xl overflow-hidden',
          // Mobile: bottom sheet
          'rounded-t-[24px] max-h-[90dvh]',
          // Desktop: centered floating modal
          'md:max-w-[540px] md:rounded-[24px] md:max-h-[85vh]',
          side === 'right' && 'md:max-w-[440px] md:h-[calc(100vh-2rem)] md:rounded-l-[24px] md:rounded-r-none md:ml-auto',
          className,
        )}
      >
        {/* Mobile Drag Handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 md:hidden active:cursor-grabbing"
        >
          <span className="h-1.5 w-12 rounded-full bg-line" />
        </div>

        {/* Header */}
        {(title || !hideClose) && (
          <header className="flex shrink-0 items-start justify-between gap-3 px-6 py-4 border-b border-line bg-surface-raised">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent mb-0.5">
                  {eyebrow}
                </p>
              )}
              {title && <h2 className="truncate text-lg font-bold text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-muted truncate">{subtitle}</p>}
            </div>

            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink transition-colors"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </header>
        )}

        {/* Scrollable Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface-raised px-6 py-4">
            {footer}
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}
