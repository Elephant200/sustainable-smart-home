import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Car, Calendar, Zap, DollarSign, Clock, Battery, Leaf, TrendingUp, MapPin, Settings } from "lucide-react";
import { EVChargingChart } from "@/components/visualizations/ev-charging-chart";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Charging",
};

// Fake data for EVs
const evVehicles = [
  {
    id: 1,
    name: "Tesla Model 3",
    batteryLevel: 78,
    range: 234,
    maxRange: 300,
    chargingStatus: "completed",
    pluggedIn: true,
    chargeRate: 0,
    estimatedFullTime: "0:00",
    lastCharged: "6:23 AM",
    efficiency: "4.2 mi/kWh"
  },
  {
    id: 2,
    name: "BMW i4",
    batteryLevel: 45,
    range: 126,
    maxRange: 280,
    chargingStatus: "charging",
    pluggedIn: true,
    chargeRate: 7.2,
    estimatedFullTime: "3:15",
    lastCharged: "Now",
    efficiency: "3.8 mi/kWh"
  }
];



function EVStatusCard({ vehicle }: { vehicle: typeof evVehicles[0] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "charging": return "text-green-600 bg-green-50 border-green-200";
      case "completed": return "text-blue-600 bg-blue-50 border-blue-200";
      case "disconnected": return "text-gray-600 bg-gray-50 border-gray-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "charging": return <Badge className="bg-green-100 text-green-800 border-green-200">Charging</Badge>;
      case "completed": return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Completed</Badge>;
      case "disconnected": return <Badge variant="outline">Disconnected</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className={`border-2 ${getStatusColor(vehicle.chargingStatus)}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {vehicle.name}
          </div>
          {getStatusBadge(vehicle.chargingStatus)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Battery Level</span>
            <span className="font-semibold">{vehicle.batteryLevel}%</span>
          </div>
          <Progress value={vehicle.batteryLevel} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Range</span>
            <div className="font-semibold">{vehicle.range} mi</div>
          </div>
          <div>
            <span className="text-muted-foreground">Charge Rate</span>
            <div className="font-semibold">{vehicle.chargeRate} kW</div>
          </div>
          <div>
            <span className="text-muted-foreground">Time to Full</span>
            <div className="font-semibold">{vehicle.estimatedFullTime}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Efficiency</span>
            <div className="font-semibold">{vehicle.efficiency}</div>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Last charged: {vehicle.lastCharged}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EVChargingPage() {
  const totalPowerCurrently = evVehicles.reduce((sum, ev) => sum + ev.chargeRate, 0);
  const totalEnergyUsedOvernight = 156.3; // kWh from overnight charging
  const costSavings = 23.45; // dollars saved from smart charging

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Electric Vehicle Charging</CardTitle>
          <CardDescription>
            Smart EV charging with solar integration and cost optimization for your {evVehicles.length} vehicles
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Current Charging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{totalPowerCurrently.toFixed(1)} kW</div>
            <div className="text-sm text-muted-foreground">
              {evVehicles.filter(ev => ev.chargingStatus === "charging").length} vehicle(s) charging
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-blue-500" />
              Energy Used (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalEnergyUsedOvernight} kWh</div>
            <div className="text-sm text-muted-foreground">Overnight charging</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Cost Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${costSavings}</div>
            <div className="text-sm text-green-600">vs peak rate charging</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-emerald-500" />
              Clean Energy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">73%</div>
            <div className="text-sm text-muted-foreground">Solar + battery powered</div>
          </CardContent>
        </Card>
      </div>

      {/* Overnight Charging Chart */}
      <EVChargingChart />

      {/* Individual Vehicle Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Vehicle Status</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {evVehicles.map((vehicle) => (
            <EVStatusCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Smart Charging Schedule
            </CardTitle>
            <CardDescription>Optimized charging based on rates and solar</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Edit Schedule</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Tesla Model 3</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">10:00 PM - 6:00 AM</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">BMW i4</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">11:00 PM - 1:00 PM</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Priority Mode</span>
                <Badge variant="default" className="bg-purple-100 text-purple-800">Solar First</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Off-Peak Hours</span>
                <span className="font-semibold">10 PM - 6 AM</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Energy Source Mix
            </CardTitle>
            <CardDescription>Last 24 hours charging sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Solar Direct</span>
                <span className="font-semibold">32.1 kWh (21%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Battery Storage</span>
                <span className="font-semibold">81.4 kWh (52%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid (Off-Peak)</span>
                <span className="font-semibold">42.8 kWh (27%)</span>
              </div>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="text-sm font-semibold text-green-600">
                  73% renewable energy used
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>July 2025 EV charging performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">4.2 MWh</div>
              <div className="text-sm text-muted-foreground">Energy Consumed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">$287</div>
              <div className="text-sm text-muted-foreground">Cost Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">68%</div>
              <div className="text-sm text-muted-foreground">Solar Powered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">1,847</div>
              <div className="text-sm text-muted-foreground">Miles Driven</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 