import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { cn } from '@/lib/cn'

const ToastContext = createContext(null)

const TONE = {
  success: { icon: 'checkCircle', ring: 'ring-success/25', text: 'text-success' },
  error: { icon: 'alert', ring: 'ring-danger/25', text: 'text-danger' },
  info: { icon: 'info', ring: 'ring-accent/25', text: 'text-accent' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    ({ tone = 'info', title, message, duration = 3600 }) => {
      idRef.current += 1
      const id = idRef.current
      setToasts((list) => [...list.slice(-2), { id, tone, title, message }])
      setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] flex flex-col items-center gap-2 px-4">
          {toasts.map((toast) => {
            const tone = TONE[toast.tone] ?? TONE.info
            return (
              <div
                key={toast.id}
                role="status"
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm animate-[fade-in_0.24s_var(--ease-out-expo)] items-start gap-2.5',
                  'rounded-[14px] bg-surface px-4 py-3 card-shadow ring-1',
                  tone.ring,
                )}
              >
                <Icon name={tone.icon} size={18} className={cn('mt-px shrink-0', tone.text)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{toast.title}</p>
                  {toast.message && <p className="mt-0.5 text-[13px] text-muted">{toast.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss"
                  className="-mr-1 -mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-sunken"
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
