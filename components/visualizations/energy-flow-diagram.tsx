"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Sun, Battery, Home, Car, Zap, ArrowRight } from "lucide-react"
import { SkeletonChartCard } from "@/components/ui/skeleton"
import { useSnapshot } from "@/lib/hooks/use-energy-data"

type DeviceKey = "solar" | "battery" | "house" | "ev" | "grid"

const DEVICE_META: Record<
  DeviceKey,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  solar: { icon: Sun, color: "border-chart-1 text-chart-1" },
  battery: { icon: Battery, color: "border-chart-2 text-chart-2" },
  house: { icon: Home, color: "border-chart-4 text-chart-4" },
  ev: { icon: Car, color: "border-chart-5 text-chart-5" },
  grid: { icon: Zap, color: "border-chart-3 text-chart-3" },
}

const POSITIONS: Record<DeviceKey, { x: number; y: number }> = {
  solar: { x: 20, y: 30 },
  grid: { x: 20, y: 70 },
  battery: { x: 50, y: 50 },
  house: { x: 80, y: 30 },
  ev: { x: 80, y: 70 },
}

function DeviceNode({
  device,
  power,
  extra,
}: {
  device: DeviceKey
  power: number
  extra?: string
}) {
  const meta = DEVICE_META[device]
  const Icon = meta.icon
  const pos = POSITIONS[device]
  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <div
        className={`relative w-20 h-20 rounded-full border-4 ${meta.color} bg-card flex flex-col items-center justify-center shadow-lg`}
      >
        <Icon className="h-6 w-6 mb-1" />
        <div className="text-xs font-bold">{Math.abs(power).toFixed(1)} kW</div>
        {extra && <div className="text-xs opacity-75">{extra}</div>}
      </div>
    </div>
  )
}

function PowerFlow({
  power,
  fromKey,
  toKey,
  containerWidth,
  containerHeight,
}: {
  power: number
  fromKey: DeviceKey
  toKey: DeviceKey
  containerWidth: number
  containerHeight: number
}) {
  if (Math.abs(power) < 0.1) return null
  const fromPos = POSITIONS[fromKey]
  const toPos = POSITIONS[toKey]
  const fromX = (fromPos.x / 100) * containerWidth
  const fromY = (fromPos.y / 100) * containerHeight
  const toX = (toPos.x / 100) * containerWidth
  const toY = (toPos.y / 100) * containerHeight
  const r = 40
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / dist
  const uy = dy / dist
  const startX = fromX + r * ux
  const startY = fromY + r * uy
  const endX = toX - r * ux
  const endY = toY - r * uy
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2
  return (
    <>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <polygon
        points={`${endX - 8},${endY - 4} ${endX},${endY} ${endX - 8},${endY + 4}`}
        fill="hsl(var(--primary))"
      />
      <foreignObject x={midX - 30} y={midY - 12} width="60" height="24">
        <div className="flex items-center justify-center bg-card rounded-full px-2 py-1 border shadow-sm">
          <span className="text-xs font-semibold">{Math.abs(power).toFixed(1)} kW</span>
        </div>
      </foreignObject>
    </>
  )
}

export function EnergyFlowDiagram() {
  const { data, loading, error } = useSnapshot()

  if (loading) return <SkeletonChartCard height={384} />

  if (!data || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Real-Time Energy Flow</CardTitle>
          <CardDescription>Unable to load live flow snapshot.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { flows, devices } = data
  const containerWidth = 800
  const containerHeight = 300

  const edgePower = (source: DeviceKey, target: DeviceKey) => {
    const e = flows.edges.find((x) => x.source === source && x.target === target)
    return e?.power_kw ?? 0
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Real-Time Energy Flow
        </CardTitle>
        <CardDescription>
          Live power distribution across your smart home energy system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-96 bg-gradient-to-br from-chart-2/10 to-primary/10 rounded-lg border overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                backgroundSize: "20px 20px",
              }}
            />
          </div>
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            preserveAspectRatio="none"
          >
            {flows.edges.map((e, idx) => (
              <PowerFlow
                key={`${e.source}-${e.target}-${idx}`}
                power={e.power_kw}
                fromKey={e.source as DeviceKey}
                toKey={e.target as DeviceKey}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
              />
            ))}
          </svg>

          <DeviceNode device="solar" power={flows.solar_kw} />
          <DeviceNode
            device="battery"
            power={flows.battery_power_kw}
            extra={
              devices.battery
                ? `${Math.round(devices.battery.soc_percent)}%`
                : undefined
            }
          />
          <DeviceNode device="house" power={flows.house_kw} />
          <DeviceNode device="ev" power={flows.ev_kw} />
          <DeviceNode device="grid" power={flows.grid_kw} />

          <div className="absolute bottom-4 left-4 bg-card rounded-lg p-3 shadow-sm border">
            <div className="text-xs font-semibold mb-2">Legend</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-primary rounded-full" />
                <span>Power Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-primary" />
                <span>Direction & Power</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 bg-card rounded-lg p-3 shadow-sm border">
            <div className="text-xs font-semibold mb-2">System Total</div>
            <div className="space-y-1 text-xs">
              <div>Generation: {flows.solar_kw.toFixed(1)} kW</div>
              <div>Consumption: {(flows.house_kw + flows.ev_kw).toFixed(1)} kW</div>
              <div>Net: {(flows.solar_kw - flows.house_kw - flows.ev_kw).toFixed(1)} kW</div>
              {edgePower("solar", "grid") > 0.1 && (
                <div className="text-primary">
                  Exporting {edgePower("solar", "grid").toFixed(1)} kW
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
