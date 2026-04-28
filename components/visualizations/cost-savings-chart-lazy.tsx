"use client";

import dynamic from "next/dynamic";
import { SkeletonChartCard } from "@/components/ui/skeleton";

export const CostSavingsChart = dynamic(
  () =>
    import("./cost-savings-chart").then((mod) => ({
      default: mod.CostSavingsChart,
    })),
  {
    ssr: false,
    loading: () => <SkeletonChartCard height={350} />,
  }
);
