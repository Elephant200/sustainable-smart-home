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

type GridData = {
  id: string
  timestamp: string
  grid_carbon_intensity: number
  zone: string
  updated_at: string
}

const chartConfig = {
  carbonIntensity: {
    label: "Carbon Intensity",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function CarbonIntensityChart() {
  const [timeRange, setTimeRange] = React.useState("24h")
  const [data, setData] = React.useState<GridData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/grid-data')
        if (!response.ok) {
          throw new Error('Failed to fetch grid data')
        }
        const gridData = await response.json()
        setData(gridData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Helper function to aggregate data by specified hour intervals
  const aggregateData = React.useCallback((rawData: GridData[], intervalHours: number) => {
    if (!rawData.length) return []

    const aggregated: { [key: string]: { values: number[], timestamp: string, zone: string } } = {}

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
          zone: item.zone
        }
      }
      
      aggregated[key].values.push(item.grid_carbon_intensity)
    })

    // Calculate averages and return sorted data
    return Object.values(aggregated)
      .map(group => ({
        timestamp: group.timestamp,
        carbonIntensity: Math.round(group.values.reduce((sum, val) => sum + val, 0) / group.values.length),
        zone: group.zone,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [])

  const filteredData = React.useMemo(() => {
    if (!data.length) return []

    const now = new Date()
    let hoursBack = 24

    switch (timeRange) {
      case "24h":
        hoursBack = 25
        break
      case "7d":
        hoursBack = 7 * 24
        break
      case "3m":
        hoursBack = 3 * 30 * 24
        break
      case "1y":
        hoursBack = 365 * 24
        break
    }

    const cutoffDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)

    const filteredRawData = data
      .filter(item => new Date(item.timestamp) >= cutoffDate)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // For longer time periods, aggregate data to reduce granularity
    if (timeRange === "3m") {
      // Aggregate to 12-hour intervals for 3 months
      return aggregateData(filteredRawData, 12)
    } else if (timeRange === "1y") {
      // Aggregate to 1-day intervals for 1 year  
      return aggregateData(filteredRawData, 24) // 24 hours = 1 day
    } else {
      // Return hourly data for shorter time periods
      return filteredRawData.map(item => ({
        timestamp: item.timestamp,
        carbonIntensity: item.grid_carbon_intensity,
        zone: item.zone,
      }))
    }
  }, [data, timeRange, aggregateData])

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case "24h": return "Past 24 hours"
      case "7d": return "Past 7 days"
      case "3m": return "Past 3 months"
      case "1y": return "Past year"
      default: return "Past 24 hours"
    }
  }

  // Calculate y-axis domain with smart padding and 100-unit height intervals
  const yAxisDomain = React.useMemo(() => {
    if (!filteredData.length) return [0, 100]

    const values = filteredData.map(d => d.carbonIntensity)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)

    // Start with minimum padding of 25 on each side
    const paddedMin = dataMin - 25
    const paddedMax = dataMax + 25
    const currentRange = paddedMax - paddedMin

    // Round up to next multiple of 100
    const targetRange = Math.ceil(currentRange / 100) * 100

    // Calculate center point of the data
    const center = (paddedMin + paddedMax) / 2

    // Calculate ideal min/max to center the data in the target range
    const idealMin = center - (targetRange / 2)

    // Round to multiples of 25, ensuring non-negative minimum
    let roundedMin = Math.max(0, Math.floor(idealMin / 25) * 25)
    let roundedMax = roundedMin + targetRange

    // Ensure max is also a multiple of 25
    roundedMax = Math.ceil(roundedMax / 25) * 25

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
            <CardTitle>Grid Carbon Intensity</CardTitle>
            <CardDescription>Loading carbon intensity data...</CardDescription>
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

  if (error) {
    return (
      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Grid Carbon Intensity</CardTitle>
            <CardDescription>Error loading carbon intensity data</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Grid Carbon Intensity</CardTitle>
          <CardDescription>
            {timeRange === "3m" 
              ? "Carbon intensity averaged over 12-hour periods (gCO₂/kWh)"
              : timeRange === "1y"
              ? "Carbon intensity averaged over 1-day periods (gCO₂/kWh)" 
              : "Real-time carbon intensity of the electricity grid (gCO₂/kWh)"
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
              Past 24 hours
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Past 7 days
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
              <linearGradient id="fillCarbonIntensity" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-carbonIntensity)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-carbonIntensity)"
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
                    year: "2-digit",
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
                    `${value} gCO₂/kWh`,
                    timeRange === "3m" ? "Avg Carbon Intensity (12h)" : 
                    timeRange === "1y" ? "Avg Carbon Intensity (1d)" : 
                    "Carbon Intensity"
                  ]}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="carbonIntensity"
              type="natural"
              fill="url(#fillCarbonIntensity)"
              stroke="var(--color-carbonIntensity)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
