"use client";

import dynamic from "next/dynamic";
import { SkeletonChartCard } from "@/components/ui/skeleton";

export const EnergyFlowChart = dynamic(
  () =>
    import("./energy-flow-chart").then((mod) => ({
      default: mod.EnergyFlowChart,
    })),
  {
    ssr: false,
    loading: () => <SkeletonChartCard height={400} />,
  }
);
