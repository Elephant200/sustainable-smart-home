"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSolarData } from "@/lib/hooks/use-data-generation"

type SolarGenerationData = {
  timestamp: string
  total_generation_kwh: number
  hour: string
}

const chartConfig = {
  total_generation_kwh: {
    label: "Solar Generation",
    color: "hsl(45, 93%, 47%)", // Solar yellow color instead of purple
  },
} satisfies ChartConfig

export function SolarGenerationChart() {
  const [timeRange, setTimeRange] = React.useState("24h")
  const { data: rawData, loading } = useSolarData(timeRange)

  // Helper function to aggregate data by specified hour intervals (same as carbon intensity chart)
  const aggregateData = React.useCallback((rawData: SolarGenerationData[], intervalHours: number) => {
    if (!rawData.length) return []

    const aggregated: { [key: string]: { values: number[], timestamp: string } } = {}

    rawData.forEach(item => {
      const date = new Date(item.timestamp)
      
      // Round down to the nearest interval
      const intervalStart = new Date(date)
      const hoursSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60))
      const intervalIndex = Math.floor(hoursSinceEpoch / intervalHours)
      intervalStart.setTime(intervalIndex * intervalHours * 60 * 60 * 1000)
      
      const key = intervalStart.toISOString()
      
      if (!aggregated[key]) {
        aggregated[key] = {
          values: [],
          timestamp: intervalStart.toISOString(),
        }
      }
      
      aggregated[key].values.push(item.total_generation_kwh)
    })

    // Calculate averages and return sorted data
    return Object.values(aggregated)
      .map(group => ({
        timestamp: group.timestamp,
        total_generation_kwh: Math.round((group.values.reduce((sum, val) => sum + val, 0) / group.values.length) * 100) / 100, // Round to 2 decimal places
        hour: new Date(group.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [])

  const filteredData = React.useMemo(() => {
    if (!rawData.length) return []

    // Transform the generated data to match the expected format
    const transformedData: SolarGenerationData[] = rawData.map(item => ({
      timestamp: item.timestamp,
      total_generation_kwh: item.total_generation_kwh,
      hour: new Date(item.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }))

    // For longer time periods, aggregate data to reduce granularity (same as carbon intensity chart)
    if (timeRange === "3m") {
      // Aggregate to 12-hour intervals for 3 months
      return aggregateData(transformedData, 12)
    } else if (timeRange === "1y") {
      // Aggregate to 1-day intervals for 1 year  
      return aggregateData(transformedData, 24) // 24 hours = 1 day
    } else {
      // Return hourly data for shorter time periods
      return transformedData
    }
  }, [rawData, timeRange, aggregateData])

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case "24h": return "Last 24 hours"
      case "7d": return "Last 7 days"
      case "3m": return "Past 3 months"
      case "1y": return "Past year"
      default: return "Last 24 hours"
    }
  }

  // Calculate y-axis domain with smart padding and appropriate intervals (adapted from carbon intensity chart)
  const yAxisDomain = React.useMemo(() => {
    if (!filteredData.length) return [0, 5]

    const values = filteredData.map(d => d.total_generation_kwh)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)

    // Determine appropriate interval based on data range (smaller intervals for solar data)
    const dataRange = dataMax - dataMin
    let baseInterval: number
    let paddingInterval: number
    
    if (dataRange <= 1) {
      baseInterval = 0.25
      paddingInterval = 0.25
    } else if (dataRange <= 10) {
      baseInterval = 0.5
      paddingInterval = 0.5
    } else if (dataRange <= 25) {
      baseInterval = 1
      paddingInterval = 1
    } else {
      baseInterval = 2
      paddingInterval = 2
    }

    // Start with minimum padding on each side
    const paddedMin = dataMin - paddingInterval
    const paddedMax = dataMax + paddingInterval
    const currentRange = paddedMax - paddedMin

    // Round up to next multiple of baseInterval * 2 (to get nice range)
    const targetRange = Math.ceil(currentRange / (baseInterval * 2)) * (baseInterval * 2)

    // Calculate center point of the data
    const center = (paddedMin + paddedMax) / 2

    // Calculate ideal min/max to center the data in the target range
    const idealMin = center - (targetRange / 2)

    // Round to multiples of baseInterval, ensuring non-negative minimum
    let roundedMin = Math.max(0, Math.floor(idealMin / baseInterval) * baseInterval)
    let roundedMax = roundedMin + targetRange

    // Ensure max is also a multiple of baseInterval
    roundedMax = Math.ceil(roundedMax / baseInterval) * baseInterval

    // If rounding the max changed the range, adjust the min to maintain target range
    if (roundedMax - roundedMin !== targetRange) {
      roundedMin = roundedMax - targetRange
      roundedMin = Math.max(0, roundedMin)
    }

    return [roundedMin, roundedMax]
  }, [filteredData])

  if (loading) {
    return (
      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Solar Generation</CardTitle>
            <CardDescription>Loading solar generation data...</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Solar Generation</CardTitle>
          <CardDescription>
            {timeRange === "3m" 
              ? "Solar generation averaged over 12-hour periods (kWh)"
              : timeRange === "1y"
              ? "Solar generation averaged over 1-day periods (kWh)" 
              : "Monitor your solar panels' energy production (kWh)"
            }
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select time range"
          >
            <SelectValue placeholder={getTimeRangeLabel(timeRange)} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="24h" className="rounded-lg">
              Last 24 hours
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
            <SelectItem value="3m" className="rounded-lg">
              Past 3 months
            </SelectItem>
            <SelectItem value="1y" className="rounded-lg">
              Past year
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSolar" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-total_generation_kwh)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-total_generation_kwh)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                if (timeRange === "24h") {
                  return date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                } else if (timeRange === "7d") {
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                } else if (timeRange === "3m") {
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                } else if (timeRange === "1y") {
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    year: "2-digit",
                  })
                } else {
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}`}
              domain={yAxisDomain}
              tickCount={5}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    if (timeRange === "24h" || timeRange === "7d") {
                      return date.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    } else if (timeRange === "3m") {
                      return `${date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                      })} (12-hour avg)`
                    } else if (timeRange === "1y") {
                      return `${date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })} (1-day avg)`
                    } else {
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                  }}
                  formatter={(value) => [
                    `${value} kWh`,
                    timeRange === "3m" ? "Avg Solar Generation (12h)" : 
                    timeRange === "1y" ? "Avg Solar Generation (1d)" : 
                    "Solar Generation"
                  ]}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="total_generation_kwh"
              type="natural"
              fill="url(#fillSolar)"
              stroke="var(--color-total_generation_kwh)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
} 