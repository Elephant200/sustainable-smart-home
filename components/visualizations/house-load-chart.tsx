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

type HouseLoadData = {
  timestamp: string
  energy_kwh: number
  hour: string
}

const chartConfig = {
  energy_kwh: {
    label: "Energy Usage",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function HouseLoadChart() {
  const [timeRange, setTimeRange] = React.useState("24h")
  const [data, setData] = React.useState<HouseLoadData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/house-load-data?timeRange=${timeRange}`)
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch house load data')
        }

        setData(result.data)
      } catch (err) {
        console.error("Error fetching house load data:", err)
        setError("Failed to load house energy data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timeRange])

  // Helper function to aggregate data by specified hour intervals (same as other charts)
  const aggregateData = React.useCallback((rawData: HouseLoadData[], intervalHours: number) => {
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
      
      aggregated[key].values.push(item.energy_kwh)
    })

    // Calculate averages and return sorted data
    return Object.values(aggregated)
      .map(group => ({
        timestamp: group.timestamp,
        energy_kwh: Math.round((group.values.reduce((sum, val) => sum + val, 0) / group.values.length) * 100) / 100, // Round to 2 decimal places
        hour: new Date(group.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [])

  const filteredData = React.useMemo(() => {
    if (!data.length) return []

    // For longer time periods, aggregate data to reduce granularity (same as other charts)
    if (timeRange === "3m") {
      // Aggregate to 12-hour intervals for 3 months
      return aggregateData(data, 12)
    } else if (timeRange === "1y") {
      // Aggregate to 1-day intervals for 1 year  
      return aggregateData(data, 24) // 24 hours = 1 day
    } else {
      // Return hourly data for shorter time periods
      return data
    }
  }, [data, timeRange, aggregateData])

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case "24h": return "Last 24 hours"
      case "7d": return "Last 7 days"
      case "3m": return "Past 3 months"
      case "1y": return "Past year"
      default: return "Last 24 hours"
    }
  }

  if (loading) {
    return (
      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>House Energy Load</CardTitle>
            <CardDescription>Loading house energy data...</CardDescription>
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
            <CardTitle>House Energy Load</CardTitle>
            <CardDescription>Error loading house energy data</CardDescription>
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
          <CardTitle>House Energy Load</CardTitle>
          <CardDescription>
            {timeRange === "3m" 
              ? "Energy usage averaged over 12-hour periods (kWh)"
              : timeRange === "1y"
              ? "Energy usage averaged over 1-day periods (kWh)" 
              : "Monitor your home's energy consumption patterns (kWh)"
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
              <linearGradient id="fillHouseLoad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-energy_kwh)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-energy_kwh)"
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
                    timeRange === "3m" ? "Avg Energy Usage (12h)" : 
                    timeRange === "1y" ? "Avg Energy Usage (1d)" : 
                    "Energy Usage"
                  ]}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="energy_kwh"
              type="natural"
              fill="url(#fillHouseLoad)"
              stroke="var(--color-energy_kwh)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
} 