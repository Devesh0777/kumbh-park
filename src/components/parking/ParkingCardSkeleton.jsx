import { Skeleton } from '@/components/ui/Skeleton'

/** Result-card placeholder — matches the final layout so nothing jumps (spec §3.6). */
export default function ParkingCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] bg-surface p-2.5 card-shadow">
      <Skeleton className="aspect-square w-[104px] shrink-0 sm:w-[132px]" rounded="rounded-[12px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <Skeleton className="h-3.5 w-4/5" rounded="rounded-full" />
        <Skeleton className="h-3 w-3/5" rounded="rounded-full" />
        <Skeleton className="h-3 w-2/5" rounded="rounded-full" />
        <div className="mt-auto flex items-end justify-between">
          <Skeleton className="h-3 w-24" rounded="rounded-full" />
          <Skeleton className="h-4 w-16" rounded="rounded-full" />
        </div>
      </div>
    </div>
  )
}
