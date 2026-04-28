import {
  SkeletonDeviceRow,
  SkeletonPageHeader,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <SkeletonPageHeader />
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3 pt-2">
          <SkeletonDeviceRow />
          <SkeletonDeviceRow />
          <SkeletonDeviceRow />
        </div>
      </div>
    </div>
  );
}
