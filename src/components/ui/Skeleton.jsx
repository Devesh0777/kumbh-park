import { cn } from '@/lib/cn'

/** Skeleton block — shimmer instead of a spinner (spec §3.6). */
export function Skeleton({ className, rounded = 'rounded-[10px]' }) {
  return <div className={cn('skeleton', rounded, className)} aria-hidden />
}

export function SkeletonText({ lines = 2, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
          rounded="rounded-full"
        />
      ))}
    </div>
  )
}
