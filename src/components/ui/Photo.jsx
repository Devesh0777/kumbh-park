import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { fallbackIllustrationUri, photoUri } from '@/lib/photo'

/** Photo with automatic offline/network error fallback. */
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
          'size-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-80'
        )}
      />
      {children}
    </div>
  )
}
