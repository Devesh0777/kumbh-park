import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { currentHost, currentUser } from '@/api/mock/hosts'
import { isMock } from '@/api'

/**
 * Tiny app-wide store. Holds the mock session, saved listings and the filter
 * state that has to survive navigation between Search and Listing detail.
 * Replace the bodies with real auth/session calls when the backend lands.
 */
const AppContext = createContext(null)

export const DEFAULT_FILTERS = {
  zone: 'all',
  q: '',
  vehicle: 'all',
  features: [],
  maxPrice: null,
  plan: 'hour',
  instant: false,
  onlyAvailable: false,
  openNow: true,
  sort: 'recommended',
}

export function AppProvider({ children }) {
  const [user] = useState(() => currentUser)
  const [host] = useState(() => currentHost)
  const [saved, setSaved] = useState(() => new Set(['s6']))
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const toggleSaved = useCallback((spotId) => {
    setSaved((current) => {
      const next = new Set(current)
      if (next.has(spotId)) next.delete(spotId)
      else next.add(spotId)
      return next
    })
  }, [])

  const patchFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const value = useMemo(
    () => ({
      user,
      host,
      saved,
      toggleSaved,
      isSaved: (id) => saved.has(id),
      filters,
      patchFilters,
      resetFilters,
      isMock,
    }),
    [user, host, saved, toggleSaved, filters, patchFilters, resetFilters],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
