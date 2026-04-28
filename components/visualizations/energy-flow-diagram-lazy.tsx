"use client";

import dynamic from "next/dynamic";
import { SkeletonChartCard } from "@/components/ui/skeleton";

export const EnergyFlowDiagram = dynamic(
  () =>
    import("./energy-flow-diagram").then((mod) => ({
      default: mod.EnergyFlowDiagram,
    })),
  {
    ssr: false,
    loading: () => <SkeletonChartCard height={384} />,
  }
);
