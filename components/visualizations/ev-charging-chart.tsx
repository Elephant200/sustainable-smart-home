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

// Chart configuration
const chartConfig = {
  teslaModel3: {
    label: "Tesla Model 3",
    color: "hsl(221, 83%, 53%)", // Blue
  },
  bmwI4: {
    label: "BMW i4", 
    color: "hsl(142, 76%, 36%)", // Green
  },
} satisfies ChartConfig

// Overnight charging data (last 24 hours)
const overnightChargingData = [
  { time: "6:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "18:00" },
  { time: "7:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "19:00" },
  { time: "8:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "20:00" },
  { time: "9:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "21:00" },
  { time: "10:00 PM", teslaModel3: 11.5, bmwI4: 0, totalPower: 11.5, hour: "22:00" },
  { time: "11:00 PM", teslaModel3: 11.5, bmwI4: 7.2, totalPower: 18.7, hour: "23:00" },
  { time: "12:00 AM", teslaModel3: 11.5, bmwI4: 7.2, totalPower: 18.7, hour: "00:00" },
  { time: "1:00 AM", teslaModel3: 11.5, bmwI4: 7.2, totalPower: 18.7, hour: "01:00" },
  { time: "2:00 AM", teslaModel3: 11.5, bmwI4: 7.2, totalPower: 18.7, hour: "02:00" },
  { time: "3:00 AM", teslaModel3: 11.5, bmwI4: 7.2, totalPower: 18.7, hour: "03:00" },
  { time: "4:00 AM", teslaModel3: 8.2, bmwI4: 7.2, totalPower: 15.4, hour: "04:00" },
  { time: "5:00 AM", teslaModel3: 4.1, bmwI4: 7.2, totalPower: 11.3, hour: "05:00" },
  { time: "6:00 AM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "06:00" },
  { time: "7:00 AM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "07:00" },
  { time: "8:00 AM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "08:00" },
  { time: "9:00 AM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "09:00" },
  { time: "10:00 AM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "10:00" },
  { time: "11:00 AM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "11:00" },
  { time: "12:00 PM", teslaModel3: 0, bmwI4: 7.2, totalPower: 7.2, hour: "12:00" },
  { time: "1:00 PM", teslaModel3: 0, bmwI4: 3.6, totalPower: 3.6, hour: "13:00" },
  { time: "2:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "14:00" },
  { time: "3:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "15:00" },
  { time: "4:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "16:00" },
  { time: "5:00 PM", teslaModel3: 0, bmwI4: 0, totalPower: 0, hour: "17:00" },
];

export function EVChargingChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          24-Hour Charging Activity
        </CardTitle>
        <CardDescription>
          Power consumption showing overnight smart charging schedule
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <AreaChart data={overnightChargingData}>
            <defs>
              <linearGradient id="fillTesla" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-teslaModel3)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-teslaModel3)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBMW" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-bmwI4)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-bmwI4)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis 
              dataKey="hour" 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const hour = parseInt(value.split(':')[0]);
                return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
              }}
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
                  labelFormatter={(value) => {
                    const hour = parseInt(value.split(':')[0]);
                    return hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;
                  }}
                  formatter={(value, name) => [
                    `${value} kW`,
                    chartConfig[name as keyof typeof chartConfig]?.label || name
                  ]}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="teslaModel3"
              type="natural"
              fill="url(#fillTesla)"
              stroke="var(--color-teslaModel3)"
              strokeWidth={2}
              stackId="1"
            />
            <Area
              dataKey="bmwI4"
              type="natural"
              fill="url(#fillBMW)"
              stroke="var(--color-bmwI4)"
              strokeWidth={2}
              stackId="1"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
} 