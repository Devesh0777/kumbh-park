import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { fallbackIllustrationUri, photoUri } from '@/lib/photo'

/** Photo with automatic offline/network error fallback and cohesive tone grading. */
export default function Photo({
  src,
  seed = 'spot',
  label = 'PARKING SPOT',
  index = 0,
  alt = '',
  ratio = 'aspect-[16/9]',
  className,
  children,
  rounded = 'rounded-[14px]',
}) {
  const initialUri = useMemo(() => src ?? photoUri(seed, label, index), [src, seed, label, index])
  const [currentSrc, setCurrentSrc] = useState(initialUri)
  const [hasError, setHasError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setCurrentSrc(initialUri)
    setHasError(false)
    setLoaded(false)
  }, [initialUri])

  const handleError = () => {
    if (!hasError) {
      setHasError(true)
      setCurrentSrc(fallbackIllustrationUri(seed, label))
    }
  }

  return (
    <div className={cn('relative overflow-hidden bg-surface-sunken', ratio, rounded, className)}>
      <img
        src={currentSrc}
        alt={alt || label}
        loading="lazy"
        decoding="async"
        onError={handleError}
        onLoad={() => setLoaded(true)}
        className={cn(
          'size-full object-cover transition-all duration-300 contrast-[1.03] saturate-[0.9] brightness-[0.96]',
          loaded ? 'opacity-100' : 'opacity-80'
        )}
      />
      {/* Subtle warm architectural grade overlay to unify photo color balance */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent mix-blend-multiply" />
      {children}
    </div>
  )
}
