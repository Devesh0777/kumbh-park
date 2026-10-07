import { useEffect } from 'react'

/** Locks background scroll + wires Escape while any sheet is open. */
export function useSheetLock(open) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        document.dispatchEvent(new CustomEvent('npc:close-sheets'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
}
