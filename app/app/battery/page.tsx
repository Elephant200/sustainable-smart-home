import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Battery, Zap, Settings, Heart, TrendingUp, Clock, Shield, Thermometer, ArrowUp, ArrowDown } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Battery Storage",
};

// Fake data for individual battery modules (consistent with solar output)
const batteryModules = [
  { id: 1, charge: 87, capacity: 13.5, health: 98, temperature: 72, status: "charging", power: 0.6 },
  { id: 2, charge: 89, capacity: 13.5, health: 96, temperature: 74, status: "charging", power: 0.8 },
  { id: 3, charge: 85, capacity: 13.5, health: 99, temperature: 71, status: "charging", power: 0.2 },
  { id: 4, charge: 88, capacity: 13.5, health: 97, temperature: 73, status: "charging", power: 0.9 },
];

// Calculate totals consistent with solar page
const totalCapacity = batteryModules.reduce((sum, module) => sum + module.capacity, 0); // 54 kWh
const avgCharge = Math.round(batteryModules.reduce((sum, module) => sum + module.charge, 0) / batteryModules.length);
const totalStoredEnergy = batteryModules.reduce((sum, module) => sum + (module.capacity * module.charge / 100), 0);
const totalChargingPower = batteryModules.reduce((sum, module) => sum + module.power, 0);
const avgHealth = Math.round(batteryModules.reduce((sum, module) => sum + module.health, 0) / batteryModules.length);

function BatteryModuleIcon({ module }: { module: typeof batteryModules[0] }) {
  const getChargeColor = (charge: number) => {
    if (charge >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (charge >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
    if (charge >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const getStatusIcon = (status: string) => {
    if (status === "charging") return <ArrowUp className="h-3 w-3 text-green-600" />;
    if (status === "discharging") return <ArrowDown className="h-3 w-3 text-orange-600" />;
    return <Zap className="h-3 w-3 text-gray-600" />;
  };

  return (
    <div className={`relative p-4 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${getChargeColor(module.charge)}`}>
      <div className="flex flex-col items-center space-y-2">
        <Battery className="h-8 w-8" />
        <div className="text-lg font-bold">{module.charge}%</div>
        <div className="text-xs opacity-75">{module.capacity} kWh</div>
        <div className="flex items-center gap-1 text-xs">
          {getStatusIcon(module.status)}
          <span>{module.power.toFixed(1)} kW</span>
        </div>
        <Progress value={module.charge} className="w-full h-1" />
        <div className="absolute -top-2 -left-2 bg-white rounded-full px-2 py-1 text-xs font-semibold border shadow-sm">
          #{module.id}
        </div>
      </div>
    </div>
  );
}

export default function BatteryPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Battery Energy Storage System</CardTitle>
          <CardDescription>
            Monitor your 4-module Tesla Powerwall system with {totalCapacity} kWh total capacity
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-blue-500" />
              State of Charge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{avgCharge}%</div>
            <div className="text-sm text-muted-foreground">{totalStoredEnergy.toFixed(1)} kWh stored</div>
            <Progress value={avgCharge} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-500" />
              Power Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+{totalChargingPower.toFixed(1)} kW</div>
            <div className="text-sm text-green-600 flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              Charging from solar
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              Time to Full
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">2.1 hrs</div>
            <div className="text-sm text-muted-foreground">At current charge rate</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{avgHealth}%</div>
            <div className="text-sm text-muted-foreground">Excellent condition</div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Battery Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            Individual Battery Modules
          </CardTitle>
          <CardDescription>
            Real-time status of each 13.5 kWh Powerwall unit
          </CardDescription>
          <CardAction>
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              All Systems Charging
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {batteryModules.map((module) => (
              <BatteryModuleIcon key={module.id} module={module} />
            ))}
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Total Capacity:</span> {totalCapacity} kWh
              </div>
              <div>
                <span className="font-semibold">Energy Stored:</span> {totalStoredEnergy.toFixed(1)} kWh
              </div>
              <div>
                <span className="font-semibold">Charging Power:</span> +{totalChargingPower.toFixed(1)} kW
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Today&apos;s Performance
            </CardTitle>
            <CardDescription>Daily energy storage metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Energy Stored</span>
                <span className="font-semibold">245.2 kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Energy Released</span>
                <span className="font-semibold">189.7 kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Net Storage</span>
                <span className="font-semibold text-green-600">+55.5 kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Efficiency</span>
                <span className="font-semibold">96.2%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Environmental Status
            </CardTitle>
            <CardDescription>Temperature and safety metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Average Temperature</span>
                <span className="font-semibold">72.5°F</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cooling Status</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Safety Systems</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Normal</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Voltage Range</span>
                <span className="font-semibold">398-402V</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Smart Optimization
            </CardTitle>
            <CardDescription>AI-powered charging strategies</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Configure</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Time-of-Use Optimization</span>
                <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Storm Watch</span>
                <Badge variant="outline">Standby</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Peak Shaving</span>
                <Badge variant="default" className="bg-blue-100 text-blue-800">Active</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid Services</span>
                <Badge variant="outline">Available</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Backup Power
            </CardTitle>
            <CardDescription>Emergency power capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Backup Time</span>
                <span className="font-semibold">18.2 hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Critical Loads</span>
                <span className="font-semibold">2.1 kW</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Backup Mode</span>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Ready</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid Connection</span>
                <Badge variant="default" className="bg-green-100 text-green-800">Online</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>November 2024 storage performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">6.8 MWh</div>
              <div className="text-sm text-muted-foreground">Energy Stored</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">$892</div>
              <div className="text-sm text-muted-foreground">Peak Shaving Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">98.1%</div>
              <div className="text-sm text-muted-foreground">Round-trip Efficiency</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">127</div>
              <div className="text-sm text-muted-foreground">Cycles Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 