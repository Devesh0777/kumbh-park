import { Skeleton } from '@/components/ui/Skeleton'

/** Result-card placeholder matching the new highway signboard layout */
export default function ParkingCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#E8E1D6] bg-white p-2.5 shadow-2xs">
      {/* Compact Signboard Placeholder */}
      <Skeleton className="h-20 w-full" rounded="rounded-lg" />
      {/* Footer Placeholder */}
      <div className="flex items-center justify-between pt-1 border-t border-[#E8E1D6]/60">
        <Skeleton className="h-3.5 w-1/3" rounded="rounded" />
        <Skeleton className="h-6 w-20" rounded="rounded" />
      </div>
    </div>
  )
}
