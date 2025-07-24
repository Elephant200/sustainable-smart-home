"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from "recharts"
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

const monthlyTrendsData = [
  { month: "Jan", solarGeneration: 6.2, consumption: 8.9, savings: 892, carbonReduced: 3.1 },
  { month: "Feb", solarGeneration: 7.1, consumption: 8.2, savings: 1024, carbonReduced: 3.6 },
  { month: "Mar", solarGeneration: 8.8, consumption: 9.1, savings: 1287, carbonReduced: 4.4 },
  { month: "Apr", solarGeneration: 9.2, consumption: 8.7, savings: 1456, carbonReduced: 4.8 },
  { month: "May", solarGeneration: 9.8, consumption: 9.3, savings: 1523, carbonReduced: 5.1 },
  { month: "Jun", solarGeneration: 10.1, consumption: 10.2, savings: 1678, carbonReduced: 5.4 },
  { month: "Jul", solarGeneration: 10.4, consumption: 11.8, savings: 1812, carbonReduced: 5.7 },
];

const chartConfig = {
  solarGeneration: {
    label: "Solar Generation (MWh)",
    color: "hsl(45, 93%, 47%)",
  },
  consumption: {
    label: "Total Consumption (MWh)",
    color: "hsl(262, 83%, 58%)",
  },
  savings: {
    label: "Cost Savings ($)",
    color: "hsl(142, 76%, 36%)",
  },
  carbonReduced: {
    label: "Carbon Reduced (tons)",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig

export function MonthlyTrendsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Monthly Performance Trends
        </CardTitle>
        <CardDescription>
          7-month trend analysis of solar generation, consumption, and savings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[350px] w-full"
        >
          <AreaChart data={monthlyTrendsData}>
            <defs>
              <linearGradient id="fillSolar" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-solarGeneration)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-solarGeneration)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillConsumption" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-consumption)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-consumption)"
                  stopOpacity={0.1}
                />
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
                  labelFormatter={(value) => `${value} 2025`}
                  formatter={(value, name) => {
                    if (name === 'solarGeneration' || name === 'consumption') {
                      return [`${value} MWh`, chartConfig[name as keyof typeof chartConfig]?.label || name];
                    }
                    if (name === 'savings') {
                      return [`$${value}`, chartConfig[name as keyof typeof chartConfig]?.label || name];
                    }
                    if (name === 'carbonReduced') {
                      return [`${value} tons`, chartConfig[name as keyof typeof chartConfig]?.label || name];
                    }
                    return [value, name];
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