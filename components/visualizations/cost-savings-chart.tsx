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

const costSavingsData = [
  { category: "Solar Generation", amount: 1260, percentage: 39.2 },
  { category: "Peak Shaving", amount: 892, percentage: 27.8 },
  { category: "Time-of-Use", amount: 456, percentage: 14.2 },
  { category: "EV Smart Charging", amount: 287, percentage: 8.9 },
  { category: "Load Optimization", amount: 187, percentage: 5.8 },
  { category: "Grid Services", amount: 134, percentage: 4.1 },
];

const chartConfig = {
  amount: {
    label: "Savings Amount",
    color: "hsl(142, 76%, 36%)",
  },
  percentage: {
    label: "Percentage",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig

export function CostSavingsChart() {
  const totalSavings = costSavingsData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Savings Breakdown
        </CardTitle>
        <CardDescription>
          Monthly savings by category - Total: ${totalSavings.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[350px] w-full"
        >
          <BarChart data={costSavingsData}>
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
                    name === 'amount' ? `$${value}` : `${value}%`,
                    name === 'amount' ? 'Monthly Savings' : 'Percentage of Total'
                  ]}
                  indicator="dot"
                />
              }
            />
            <Bar
              dataKey="amount"
              fill="var(--color-amount)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Annual Projection:</span>
              <span className="font-semibold">${(totalSavings * 12).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ROI Timeline:</span>
              <span className="font-semibold">6.2 years</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grid Independence:</span>
              <span className="font-semibold">73%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efficiency Rating:</span>
              <span className="font-semibold">A+</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 