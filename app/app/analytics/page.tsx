import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, DollarSign, Leaf, BarChart3, Zap, Sun, Battery, Car, Home, Target, Award, Shield } from "lucide-react";
import { EnergyFlowChart } from "@/components/visualizations/energy-flow-chart";
import { MonthlyTrendsChart } from "@/components/visualizations/monthly-trends-chart";
import { CostSavingsChart } from "@/components/visualizations/cost-savings-chart";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
};

// Calculated statistics consistent with other pages
const systemStats = {
  // Solar stats (consistent with solar page)
  solarCurrent: 4.86, // kW
  solarDaily: 287.5, // kWh
  solarMonthly: 10.4, // MWh (July 2025)
  
  // Battery stats (consistent with battery page)
  batteryCharge: 87, // %
  batteryStored: 47.1, // kWh
  batteryCapacity: 54, // kWh
  batteryMonthly: 6.8, // MWh
  
  // EV stats (consistent with EV page)
  evCurrent: 7.2, // kW
  evDaily: 156.3, // kWh
  evMonthly: 4.2, // MWh
  
  // House consumption
  houseDaily: 68.2, // kWh (estimated from energy balance)
  houseMonthly: 2.1, // MWh
  
  // Financial
  totalMonthlySavings: 3216, // $ (sum of all categories)
  dailySavings: 66.57, // $ (solar $43.12 + EV $23.45)
  
  // Environmental
  carbonReduced: 5.7, // tons/month
  gridIndependence: 73, // %
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Performance Insights</CardTitle>
          <CardDescription>
            Comprehensive analysis of your sustainable smart home's energy performance, cost savings, and environmental impact
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Energy Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{systemStats.solarCurrent.toFixed(1)} kW</div>
            <div className="text-sm text-muted-foreground">Current solar generation</div>
            <div className="mt-2 text-sm">
              <span className="text-blue-600 font-semibold">+{systemStats.batteryStored} kWh</span> stored
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Monthly Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${systemStats.totalMonthlySavings.toLocaleString()}</div>
            <div className="text-sm text-green-600">+18% vs last month</div>
            <div className="mt-2 text-sm text-muted-foreground">
              ${(systemStats.totalMonthlySavings * 12).toLocaleString()} annual
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-emerald-500" />
              Carbon Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{systemStats.carbonReduced} tons</div>
            <div className="text-sm text-muted-foreground">CO₂ reduced this month</div>
            <div className="mt-2 text-sm text-emerald-600">
              {(systemStats.carbonReduced * 12).toFixed(1)} tons/year
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              Grid Independence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{systemStats.gridIndependence}%</div>
            <div className="text-sm text-muted-foreground">Energy self-sufficiency</div>
            <Progress value={systemStats.gridIndependence} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Energy Flow Chart */}
      <EnergyFlowChart />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendsChart />
        <CostSavingsChart />
      </div>

      {/* System Performance Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Solar Performance
            </CardTitle>
            <CardDescription>Current month analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Generation</span>
              <span className="font-semibold">{systemStats.solarMonthly} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Efficiency</span>
              <span className="font-semibold">94%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Peak Output</span>
              <span className="font-semibold">4.9 kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Uptime</span>
              <Badge variant="default" className="bg-green-100 text-green-800">99.2%</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-4 w-4" />
              Storage Analytics
            </CardTitle>
            <CardDescription>Battery system metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Energy Stored</span>
              <span className="font-semibold">{systemStats.batteryMonthly} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Round-trip Efficiency</span>
              <span className="font-semibold">96.2%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Cycles Completed</span>
              <span className="font-semibold">127</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Health Score</span>
              <Badge variant="default" className="bg-blue-100 text-blue-800">98%</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              EV Integration
            </CardTitle>
            <CardDescription>Smart charging analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Energy Used</span>
              <span className="font-semibold">{systemStats.evMonthly} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Solar Powered</span>
              <span className="font-semibold">68%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Cost Savings</span>
              <span className="font-semibold">$287</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Smart Charging</span>
              <Badge variant="default" className="bg-purple-100 text-purple-800">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency & Optimization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              System Efficiency Report
            </CardTitle>
            <CardDescription>Overall performance analysis</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Download Report</Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Energy Utilization</span>
                <span className="font-semibold">92%</span>
              </div>
              <Progress value={92} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Load Balancing</span>
                <span className="font-semibold">88%</span>
              </div>
              <Progress value={88} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Peak Shaving</span>
                <span className="font-semibold">96%</span>
              </div>
              <Progress value={96} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Score</span>
                <span className="font-semibold">94%</span>
              </div>
              <Progress value={94} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Achievements & Goals
            </CardTitle>
            <CardDescription>Sustainability milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">70% Grid Independence</span>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-800">Achieved</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">5 tons CO₂ Reduced</span>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-800">Achieved</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">$40K Annual Savings</span>
              </div>
              <Badge variant="outline">In Progress</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <span className="text-sm">80% Grid Independence</span>
              </div>
              <Badge variant="outline">Upcoming</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Annual Summary */}
      <Card>
        <CardHeader>
          <CardTitle>2025 Annual Summary</CardTitle>
          <CardDescription>Year-to-date performance through July 2025</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">57.4 MWh</div>
              <div className="text-sm text-muted-foreground">Solar Generated</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">$21,512</div>
              <div className="text-sm text-muted-foreground">Total Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">31.7 tons</div>
              <div className="text-sm text-muted-foreground">Carbon Avoided</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">98.4%</div>
              <div className="text-sm text-muted-foreground">System Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 