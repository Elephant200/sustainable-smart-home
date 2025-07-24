"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sun, Battery, Home, Car, Zap, ArrowRight, ArrowDown, ArrowUp, ArrowLeft } from "lucide-react"

// Real-time fake data consistent with other pages
const energyFlowData = {
  solar: {
    power: 4.86, // kW - consistent with solar page
    status: "generating",
    efficiency: 94
  },
  battery: {
    power: 2.5, // kW charging - consistent with battery page  
    charge: 87, // % - consistent with battery page
    status: "charging"
  },
  house: {
    power: 3.2, // kW consumption
    status: "consuming"
  },
  ev: {
    power: 7.2, // kW charging - BMW i4 currently charging
    status: "charging"
  },
  grid: {
    power: -2.76, // kW export (negative = export)
    status: "exporting"
  }
};

function DeviceNode({ 
  device, 
  icon: Icon, 
  position, 
  color 
}: { 
  device: string; 
  icon: any; 
  position: { x: number; y: number }; 
  color: string;
}) {
  const data = energyFlowData[device as keyof typeof energyFlowData];
  
  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <div className={`relative w-20 h-20 rounded-full border-4 ${color} bg-white flex flex-col items-center justify-center shadow-lg hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6 mb-1" />
        <div className="text-xs font-bold">
          {Math.abs(data.power).toFixed(1)} kW
        </div>
        {device === "battery" && "charge" in data && (
          <div className="text-xs opacity-75">{data.charge}%</div>
        )}
      </div>
    </div>
  );
}

function PowerFlow({ 
  from, 
  to, 
  power, 
  fromPos, 
  toPos,
  containerWidth,
  containerHeight
}: { 
  from: string; 
  to: string; 
  power: number; 
  fromPos: { x: number; y: number }; 
  toPos: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
}) {
  if (Math.abs(power) < 0.1) return null; // Don't show very small flows
  
  // Convert percentage positions to actual pixels
  const fromX = (fromPos.x / 100) * containerWidth;
  const fromY = (fromPos.y / 100) * containerHeight;
  const toX = (toPos.x / 100) * containerWidth;
  const toY = (toPos.y / 100) * containerHeight;
  
  // Circle radius in pixels
  const circleRadius = 40; // 40px radius to match the 80px width circles
  
  // Calculate direction vector
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / distance;
  const unitY = dy / distance;
  
  // Calculate start and end points at circle edges
  const startX = fromX + (circleRadius * unitX);
  const startY = fromY + (circleRadius * unitY);
  const endX = toX - (circleRadius * unitX);
  const endY = toY - (circleRadius * unitY);
  
  // Midpoint for label
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  const displayPower = Math.abs(power);
  
  return (
    <>
      {/* Connection Line */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="#22c55e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      
      {/* Arrow marker */}
      <polygon
        points={`${endX-8},${endY-4} ${endX},${endY} ${endX-8},${endY+4}`}
        fill="#22c55e"
      />
      
      {/* Power Label */}
      <foreignObject
        x={midX - 30}
        y={midY - 12}
        width="60"
        height="24"
      >
        <div className="flex items-center justify-center bg-white rounded-full px-2 py-1 border shadow-sm">
          <span className="text-xs font-semibold">
            {displayPower.toFixed(1)} kW
          </span>
        </div>
      </foreignObject>
    </>
  );
}

export function EnergyFlowDiagram() {
  // Device positions (x%, y%) - Left (sources) → Center (storage) → Right (consumption)
  const positions = {
    solar: { x: 20, y: 30 },
    grid: { x: 20, y: 70 },
    battery: { x: 50, y: 50 },
    house: { x: 80, y: 30 },
    ev: { x: 80, y: 70 }
  };

  // Calculate power flows between devices
  const flows = [
    { from: "solar", to: "battery", power: 3.2, fromPos: positions.solar, toPos: positions.battery },
    { from: "solar", to: "house", power: 1.7, fromPos: positions.solar, toPos: positions.house },
    { from: "grid", to: "battery", power: 1.5, fromPos: positions.grid, toPos: positions.battery },
    { from: "battery", to: "house", power: 2.3, fromPos: positions.battery, toPos: positions.house },
    { from: "battery", to: "ev", power: 2.5, fromPos: positions.battery, toPos: positions.ev },
    { from: "grid", to: "ev", power: 4.7, fromPos: positions.grid, toPos: positions.ev },
  ];

  // Container dimensions for SVG calculations
  const containerWidth = 800;
  const containerHeight = 300;

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
        <div className="relative h-96 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border overflow-hidden">
          {/* Grid lines for visual appeal */}
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full" style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }} />
          </div>

          {/* SVG for Power Flow Lines */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            preserveAspectRatio="none"
          >
            {flows.map((flow, index) => (
              <PowerFlow 
                key={index} 
                {...flow} 
                containerWidth={containerWidth}
                containerHeight={containerHeight}
              />
            ))}
          </svg>

          {/* Device Nodes */}
          <DeviceNode 
            device="solar" 
            icon={Sun} 
            position={positions.solar} 
            color="border-yellow-500 text-yellow-600"
          />
          <DeviceNode 
            device="battery" 
            icon={Battery} 
            position={positions.battery} 
            color="border-blue-500 text-blue-600"
          />
          <DeviceNode 
            device="house" 
            icon={Home} 
            position={positions.house} 
            color="border-green-500 text-green-600"
          />
          <DeviceNode 
            device="ev" 
            icon={Car} 
            position={positions.ev} 
            color="border-purple-500 text-purple-600"
          />
          <DeviceNode 
            device="grid" 
            icon={Zap} 
            position={positions.grid} 
            color="border-orange-500 text-orange-600"
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg p-3 shadow-sm border">
            <div className="text-xs font-semibold mb-2">Legend</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-green-500 rounded-full"></div>
                <span>Power Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-green-600" />
                <span>Direction & Power</span>
              </div>
            </div>
          </div>

          {/* System Summary */}
          <div className="absolute bottom-4 right-4 bg-white rounded-lg p-3 shadow-sm border">
            <div className="text-xs font-semibold mb-2">System Total</div>
            <div className="space-y-1 text-xs">
              <div>Generation: {energyFlowData.solar.power.toFixed(1)} kW</div>
              <div>Consumption: {(energyFlowData.house.power + energyFlowData.ev.power).toFixed(1)} kW</div>
              <div>Net: {(energyFlowData.solar.power - energyFlowData.house.power - energyFlowData.ev.power).toFixed(1)} kW</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 