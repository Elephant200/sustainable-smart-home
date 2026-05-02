"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { TrendingUp } from "lucide-react"

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
import { useEv } from "@/lib/hooks/use-energy-data"

const PALETTE = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-3))",
]

export function EVChargingChart() {
  const { data, loading, error } = useEv()

  if (loading) return <SkeletonChartCard height={300} />

  const vehicleNames = data?.vehicles.map((v) => v.name) ?? []
  const series =
    data?.history.map((p) => {
      const row: Record<string, string | number> = { time: p.time }
      for (const name of vehicleNames) {
        row[name] = p.per_vehicle[name] ?? 0
      }
      return row
    }) ?? []

  const config: ChartConfig = {}
  vehicleNames.forEach((name, i) => {
    config[name] = {
      label: name,
      color: PALETTE[i % PALETTE.length],
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          24-Hour Charging Activity
        </CardTitle>
        <CardDescription>
          {error
            ? "Unable to load charging data."
            : "Power consumption showing overnight smart charging schedule"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className="aspect-auto h-[300px] w-full"
        >
          <AreaChart data={series}>
            <defs>
              {vehicleNames.map((name, i) => (
                <linearGradient
                  key={name}
                  id={`fillEv-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
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
              tickFormatter={(value) => `${value} kW`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [`${value} kW`, name]}
                  indicator="dot"
                />
              }
            />
            {vehicleNames.map((name, i) => (
              <Area
                key={name}
                dataKey={name}
                type="natural"
                fill={`url(#fillEv-${i})`}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                stackId="1"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
