import {
  SkeletonStatCard,
  SkeletonChartCard,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChartCard height={300} />
        <SkeletonChartCard height={300} />
      </div>
      <SkeletonChartCard height={280} />
    </div>
  );
}
