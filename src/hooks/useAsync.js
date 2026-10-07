import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Small async data hook used by every screen so loading/error/refetch
 * behaviour is consistent (and so skeletons are driven by one flag).
 *
 * Two invariants keep a skeleton from ever being left on:
 *
 * 1. Only the newest request may write state. `generation` increments per
 *    call, and a settle handler bails unless its own generation is still the
 *    latest. Without this, a slow earlier request that resolves after a newer
 *    one writes stale data over fresh data.
 * 2. `loading` is set true when a request starts and written false exactly
 *    once, on the settle path of that same generation. A stale generation
 *    never touches `loading`, so it cannot leave the flag stuck on.
 */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const alive = useRef(true)
  const fnRef = useRef(fn)
  const generation = useRef(0)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(() => {
    const gen = generation.current + 1
    generation.current = gen

    return Promise.resolve()
      .then(() => {
        // Announced from the promise chain rather than the effect body: a
        // synchronous setState here would cascade a render on every refetch.
        if (alive.current && generation.current === gen) {
          setLoading(true)
          setError(null)
        }
        return fnRef.current()
      })
      .then((result) => {
        if (alive.current && generation.current === gen) {
          setData(result)
          setLoading(false)
        }
        return result
      })
      .catch((err) => {
        if (alive.current && generation.current === gen) {
          setError(err)
          setLoading(false)
        }
        throw err
      })
  }, [])

  useEffect(() => {
    if (!immediate) return
    reload().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return useMemo(() => ({ data, loading, error, reload, setData }), [data, loading, error, reload])
}
