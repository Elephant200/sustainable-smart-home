"use client";

import dynamic from "next/dynamic";
import { SkeletonChartCard } from "@/components/ui/skeleton";

export const EVChargingChart = dynamic(
  () =>
    import("./ev-charging-chart").then((mod) => ({
      default: mod.EVChargingChart,
    })),
  {
    ssr: false,
    loading: () => <SkeletonChartCard height={300} />,
  }
);
