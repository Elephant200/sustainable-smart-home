import {
  SkeletonStatCard,
  SkeletonChartCard,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonChartCard height={360} />
      <SkeletonChartCard height={280} />
    </div>
  );
}
