import { useEffect, useRef } from 'react'

let observer = null

function getObserver() {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target) // reveal once, don't re-trigger
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
  )
  return observer
}

/**
 * Scroll-triggered reveal (spec §3.2). One shared observer for the whole app;
 * pass the data that renders new `.reveal` children as deps so late-arriving
 * sections are picked up too.
 */
export function useReveal(deps = []) {
  const ref = useRef(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const targets = [...root.querySelectorAll('.reveal:not(.is-visible)')]
    const obs = getObserver()
    targets.forEach((el) => obs.observe(el))
    return () => targets.forEach((el) => obs.unobserve(el))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
