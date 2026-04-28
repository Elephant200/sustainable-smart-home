import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-md",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border bg-card p-6 space-y-3",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function SkeletonChartCard({
  className,
  height = 280,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border bg-card p-6 space-y-4",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="w-full" style={{ height }} />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function SkeletonDeviceRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4",
        className
      )}
      aria-hidden="true"
    >
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

function SkeletonPageHeader({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

export {
  Skeleton,
  SkeletonStatCard,
  SkeletonChartCard,
  SkeletonDeviceRow,
  SkeletonPageHeader,
};
