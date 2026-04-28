import {
  SkeletonDeviceRow,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <SkeletonPageHeader />
      <div className="space-y-3">
        <SkeletonDeviceRow />
        <SkeletonDeviceRow />
        <SkeletonDeviceRow />
        <SkeletonDeviceRow />
        <SkeletonDeviceRow />
      </div>
    </div>
  );
}
