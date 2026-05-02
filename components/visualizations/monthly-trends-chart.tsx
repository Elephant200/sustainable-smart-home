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
import { useAnalytics } from "@/lib/hooks/use-energy-data"

const chartConfig = {
  solarGeneration: { label: "Solar Generation (MWh)", color: "hsl(var(--chart-1))" },
  consumption: { label: "Total Consumption (MWh)", color: "hsl(var(--chart-5))" },
  savings: { label: "Cost Savings ($)", color: "hsl(var(--chart-4))" },
  carbonReduced: { label: "Carbon Reduced (tons)", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

export function MonthlyTrendsChart() {
  const { data, loading, error } = useAnalytics()

  if (loading) return <SkeletonChartCard height={350} />

  const series = (data?.monthly ?? []).map((m) => ({
    month: m.monthLabel,
    solarGeneration: m.solar_mwh,
    consumption: m.consumption_mwh,
    savings: m.savings_usd,
    carbonReduced: m.carbon_reduced_tons,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Monthly Performance Trends
        </CardTitle>
        <CardDescription>
          {error
            ? "Unable to load monthly trends."
            : `${series.length}-month trend analysis of solar generation, consumption, and savings`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
          <AreaChart data={series}>
            <defs>
              <linearGradient id="fillSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-solarGeneration)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-solarGeneration)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillConsumption" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-consumption)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-consumption)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value} MWh`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "solarGeneration" || name === "consumption") {
                      return [`${value} MWh`, chartConfig[name as keyof typeof chartConfig]?.label ?? name]
                    }
                    if (name === "savings") {
                      return [`$${value}`, chartConfig[name as keyof typeof chartConfig]?.label ?? name]
                    }
                    if (name === "carbonReduced") {
                      return [`${value} tons`, chartConfig[name as keyof typeof chartConfig]?.label ?? name]
                    }
                    return [value, name]
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="consumption"
              type="natural"
              fill="url(#fillConsumption)"
              stroke="var(--color-consumption)"
              strokeWidth={2}
              stackId="1"
            />
            <Area
              dataKey="solarGeneration"
              type="natural"
              fill="url(#fillSolar)"
              stroke="var(--color-solarGeneration)"
              strokeWidth={2}
              stackId="2"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
