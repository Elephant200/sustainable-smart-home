"use client"

import * as React from "react"
import { CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts"
import { Zap } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { SkeletonChartCard } from "@/components/ui/skeleton"
import { useFlows } from "@/lib/hooks/use-energy-data"

const chartConfig = {
  solar: { label: "Solar Generation", color: "hsl(var(--chart-1))" },
  battery: { label: "Battery Storage", color: "hsl(var(--chart-2))" },
  house: { label: "House Load", color: "hsl(var(--chart-4))" },
  ev: { label: "EV Charging", color: "hsl(var(--chart-5))" },
  grid: { label: "Grid Exchange", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:00`
}

export function EnergyFlowChart() {
  const { data, loading, error } = useFlows("24h")

  if (loading) return <SkeletonChartCard height={400} />

  const points = (data?.points ?? []).map((p) => ({
    time: fmtTime(p.timestamp),
    solar: p.solar_kw,
    battery: -p.battery_kw,
    house: p.house_kw,
    ev: p.ev_kw,
    grid: -p.grid_kw,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Energy Flow Analysis
        </CardTitle>
        <CardDescription>
          {error
            ? "Unable to load flow data."
            : "24-hour energy flow between solar, battery, house, EV, and grid (kW)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[400px] w-full">
          <LineChart data={points}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value > 0 ? "+" : ""}${value} kW`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `Time: ${value}`}
                  formatter={(value, name) => [
                    `${Number(value) > 0 ? "+" : ""}${value} kW`,
                    chartConfig[name as keyof typeof chartConfig]?.label ?? name,
                  ]}
                  indicator="dot"
                />
              }
            />
            <Line dataKey="solar" type="monotone" stroke="var(--color-solar)" strokeWidth={3} dot={false} />
            <Line dataKey="battery" type="monotone" stroke="var(--color-battery)" strokeWidth={2} dot={false} />
            <Line dataKey="house" type="monotone" stroke="var(--color-house)" strokeWidth={2} dot={false} />
            <Line dataKey="ev" type="monotone" stroke="var(--color-ev)" strokeWidth={2} dot={false} />
            <Line
              dataKey="grid"
              type="monotone"
              stroke="var(--color-grid)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
