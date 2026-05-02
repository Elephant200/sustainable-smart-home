"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { DollarSign } from "lucide-react"

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
  amount: { label: "Savings Amount", color: "hsl(var(--chart-4))" },
  percentage: { label: "Percentage", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

export function CostSavingsChart() {
  const { data, loading, error } = useAnalytics()

  if (loading) return <SkeletonChartCard height={350} />

  const items = (data?.costSavings ?? []).map((c) => ({
    category: c.category,
    amount: c.amount_usd,
    percentage: c.percentage,
  }))
  const totalSavings = items.reduce((s, i) => s + i.amount, 0)
  const independence = data?.summary.grid_independence_pct ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Savings Breakdown
        </CardTitle>
        <CardDescription>
          {error
            ? "Unable to load cost data."
            : `Monthly savings by category — Total: $${totalSavings.toLocaleString()}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
          <BarChart data={items}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => value}
                  formatter={(value, name) => [
                    name === "amount" ? `$${value}` : `${value}%`,
                    name === "amount" ? "Monthly Savings" : "Percentage of Total",
                  ]}
                  indicator="dot"
                />
              }
            />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Annual Projection:</span>
              <span className="font-semibold">${(totalSavings * 12).toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grid Independence:</span>
              <span className="font-semibold">{independence}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
