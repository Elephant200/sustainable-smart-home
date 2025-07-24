"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts"
import { ArrowRight, Sun, Battery, Home, Car, Zap } from "lucide-react"

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

const energyFlowData = [
  { time: "00:00", solar: 0, battery: -8.2, house: 2.1, ev: 18.7, grid: -12.6 },
  { time: "02:00", solar: 0, battery: -9.1, house: 1.8, ev: 18.7, grid: -11.4 },
  { time: "04:00", solar: 0, battery: -6.8, house: 1.9, ev: 15.4, grid: -9.5 },
  { time: "06:00", solar: 0.8, battery: -4.2, house: 2.3, ev: 7.2, grid: -5.5 },
  { time: "08:00", solar: 2.1, battery: -1.8, house: 2.8, ev: 7.2, grid: -5.3 },
  { time: "10:00", solar: 3.8, battery: 0.5, house: 3.2, ev: 7.2, grid: -6.7 },
  { time: "12:00", solar: 4.6, battery: 1.2, house: 3.4, ev: 7.2, grid: -7.2 },
  { time: "14:00", solar: 4.2, battery: 0.8, house: 3.1, ev: 0, grid: 0.3 },
  { time: "16:00", solar: 3.5, battery: 0.4, house: 2.9, ev: 0, grid: 0.2 },
  { time: "18:00", solar: 1.8, battery: -0.8, house: 3.5, ev: 0, grid: -0.9 },
  { time: "20:00", solar: 0.2, battery: -2.1, house: 2.8, ev: 0, grid: -0.5 },
  { time: "22:00", solar: 0, battery: -5.5, house: 2.2, ev: 11.5, grid: -8.2 },
];

const chartConfig = {
  solar: {
    label: "Solar Generation",
    color: "hsl(45, 93%, 47%)",
  },
  battery: {
    label: "Battery Storage",
    color: "hsl(221, 83%, 53%)",
  },
  house: {
    label: "House Load",
    color: "hsl(142, 76%, 36%)",
  },
  ev: {
    label: "EV Charging",
    color: "hsl(262, 83%, 58%)",
  },
  grid: {
    label: "Grid Exchange",
    color: "hsl(12, 76%, 61%)",
  },
} satisfies ChartConfig

export function EnergyFlowChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Energy Flow Analysis
        </CardTitle>
        <CardDescription>
          24-hour energy flow between solar, battery, house, EV, and grid (kW)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[400px] w-full"
        >
          <LineChart data={energyFlowData}>
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
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value} kW`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `Time: ${value}`}
                  formatter={(value, name) => [
                    `${Number(value) > 0 ? '+' : ''}${value} kW`,
                    chartConfig[name as keyof typeof chartConfig]?.label || name
                  ]}
                  indicator="dot"
                />
              }
            />
            <Line
              dataKey="solar"
              type="monotone"
              stroke="var(--color-solar)"
              strokeWidth={3}
              dot={false}
            />
            <Line
              dataKey="battery"
              type="monotone"
              stroke="var(--color-battery)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="house"
              type="monotone"
              stroke="var(--color-house)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="ev"
              type="monotone"
              stroke="var(--color-ev)"
              strokeWidth={2}
              dot={false}
            />
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