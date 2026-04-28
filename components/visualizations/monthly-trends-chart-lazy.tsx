"use client";

import dynamic from "next/dynamic";
import { SkeletonChartCard } from "@/components/ui/skeleton";

export const MonthlyTrendsChart = dynamic(
  () =>
    import("./monthly-trends-chart").then((mod) => ({
      default: mod.MonthlyTrendsChart,
    })),
  {
    ssr: false,
    loading: () => <SkeletonChartCard height={350} />,
  }
);
