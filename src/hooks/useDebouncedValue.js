import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stopped changing for `delay` ms.
 *
 * Search re-queries on every filter change, and the query box patches filters
 * on each keystroke. Without a debounce each character starts a new request
 * and discards the previous one, so the result list stays on its skeleton for
 * as long as the user keeps typing.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export default useDebouncedValue
