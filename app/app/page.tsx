import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap, Activity, Settings2, Sun, Battery, Car, DollarSign } from "lucide-react";
import type { Metadata } from "next";
import { CarbonIntensityChart } from "@/components/visualizations/carbon-intensity-chart";
import { HouseLoadChart } from "@/components/visualizations/house-load-chart";
import { EnergyFlowDiagram } from "@/components/visualizations/energy-flow-diagram";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Real-time system statistics (consistent with other pages)
const systemStats = {
  // Solar (from solar page)
  solarCurrent: 4.86, // kW
  solarDaily: 287.5, // kWh
  solarEfficiency: 94, // %
  
  // Battery (from battery page)
  batteryCharge: 87, // %
  batteryPower: 2.5, // kW charging
  batteryHealth: 98, // %
  
  // EV (from EV page)
  evPower: 7.2, // kW BMW i4 charging
  evCharge: 45, // % BMW i4
  
  // House
  housePower: 3.2, // kW consumption
  
  // Grid
  gridPower: -2.76, // kW (negative = exporting)
  gridIndependence: 73, // %
  
  // Financial (from analytics)
  dailySavings: 43.12, // $
  monthlySavings: 3216, // $
  
  // Environmental
  carbonReduced: 5.7, // tons/month
  
  // System
  systemHealth: 98, // %
  activeAlerts: 4
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Real-time energy monitoring and control for your sustainable smart home
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key System Metrics - Moved to Top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Solar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{systemStats.solarCurrent} kW</div>
            <div className="text-sm text-muted-foreground">Generating now</div>
            <div className="text-xs text-green-600 mt-1">{systemStats.solarDaily} kWh today</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-blue-500" />
              Battery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{systemStats.batteryCharge}%</div>
            <div className="text-sm text-muted-foreground">+{systemStats.batteryPower} kW</div>
            <Progress value={systemStats.batteryCharge} className="mt-2 h-1" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5 text-purple-500" />
              EV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{systemStats.evPower} kW</div>
            <div className="text-sm text-muted-foreground">BMW i4 charging</div>
            <div className="text-xs text-blue-600 mt-1">{systemStats.evCharge}% charged</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${systemStats.dailySavings}</div>
            <div className="text-sm text-muted-foreground">Today</div>
            <div className="text-xs text-green-600 mt-1">${systemStats.monthlySavings} this month</div>
          </CardContent>
        </Card>
      </div>

      {/* Real-Time Energy Flow Diagram */}
      <EnergyFlowDiagram />

      {/* Carbon Intensity Chart - No redundant card */}
      <CarbonIntensityChart />

      {/* House Energy Load Chart */}
      <HouseLoadChart />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Energy Overview
            </CardTitle>
            <CardDescription>Real-time energy metrics</CardDescription>
            <CardAction>
              <Badge variant="outline">Live</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">House Load</span>
              <span className="font-semibold">{systemStats.housePower} kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Grid Export</span>
              <span className="font-semibold text-green-600">{Math.abs(systemStats.gridPower)} kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Self-Sufficiency</span>
              <span className="font-semibold">{systemStats.gridIndependence}%</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Status
            </CardTitle>
            <CardDescription>Current system health</CardDescription>
            <CardAction>
              <Badge variant="default" className="bg-green-100 text-green-800">Optimal</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">System Health</span>
              <span className="font-semibold text-green-600">{systemStats.systemHealth}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Alerts</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">{systemStats.activeAlerts}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">CO₂ Reduced</span>
              <span className="font-semibold text-emerald-600">{systemStats.carbonReduced} tons/mo</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Quick Actions
            </CardTitle>
            <CardDescription>System controls and navigation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/app/analytics">
                <Button variant="outline" size="sm" className="w-full">
                  View Analytics
                </Button>
              </Link>
              <Link href="/app/alerts">
                <Button variant="outline" size="sm" className="w-full">
                  Check Alerts
                </Button>
              </Link>
              <Link href="/app/settings">
                <Button variant="outline" size="sm" className="w-full">
                  System Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
