import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, TrendingUp, CloudSun, Battery, Zap, Leaf, DollarSign } from "lucide-react";
import type { Metadata } from "next";
import { SolarGenerationChart } from "@/components/visualizations/solar-generation-chart";

export const metadata: Metadata = {
  title: "Solar Power",
};

// Fake data for individual solar panels
const solarPanels = [
  { id: 1, production: 0.42, efficiency: 98, status: "optimal" },
  { id: 2, production: 0.41, efficiency: 96, status: "optimal" },
  { id: 3, production: 0.38, efficiency: 89, status: "good" },
  { id: 4, production: 0.43, efficiency: 99, status: "optimal" },
  { id: 5, production: 0.40, efficiency: 94, status: "optimal" },
  { id: 6, production: 0.39, efficiency: 92, status: "good" },
  { id: 7, production: 0.42, efficiency: 97, status: "optimal" },
  { id: 8, production: 0.37, efficiency: 87, status: "maintenance" },
  { id: 9, production: 0.41, efficiency: 95, status: "optimal" },
  { id: 10, production: 0.40, efficiency: 93, status: "optimal" },
  { id: 11, production: 0.39, efficiency: 91, status: "good" },
  { id: 12, production: 0.42, efficiency: 98, status: "optimal" },
];

// Fake statistics
const totalProduction = solarPanels.reduce((sum, panel) => sum + panel.production, 0);
const avgEfficiency = Math.round(solarPanels.reduce((sum, panel) => sum + panel.efficiency, 0) / solarPanels.length);

function SolarPanelIcon({ panel }: { panel: typeof solarPanels[0] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "text-green-600 bg-green-50 border-green-200";
      case "good": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "maintenance": return "text-orange-600 bg-orange-50 border-orange-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${getStatusColor(panel.status)}`}>
      <div className="flex flex-col items-center space-y-1">
        <Sun className="h-8 w-8" />
        <div className="text-sm font-bold">{panel.production} kW</div>
        <div className="text-xs opacity-75">{panel.efficiency}%</div>
        <div className="absolute -top-2 -left-2 bg-white rounded-full px-2 py-1 text-xs font-semibold border shadow-sm">
          #{panel.id}
        </div>
      </div>
    </div>
  );
}

export default function SolarPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solar Power System</CardTitle>
          <CardDescription>
            Monitor your 12-panel solar array performance and energy generation in real-time
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Current Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{totalProduction.toFixed(1)} kW</div>
            <div className="text-sm text-muted-foreground">Real-time generation</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Today&apos;s Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">28.75 kWh</div>
            <div className="text-sm text-green-600">+12% vs yesterday</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              Savings Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">$43.12</div>
            <div className="text-sm text-muted-foreground">Energy cost avoided</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-emerald-500" />
              CO2 Avoided
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">142 lbs</div>
            <div className="text-sm text-muted-foreground">Carbon footprint reduced</div>
          </CardContent>
        </Card>
      </div>

      {/* Solar Generation Chart */}
      <SolarGenerationChart />

      {/* Individual Solar Panels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Individual Panel Performance
          </CardTitle>
          <CardDescription>
            Real-time output from each of your 12 solar panels
          </CardDescription>
          <CardAction>
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              All Systems Operational
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {solarPanels.map((panel) => (
              <SolarPanelIcon key={panel.id} panel={panel} />
            ))}
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Total Panels:</span> 12
              </div>
              <div>
                <span className="font-semibold">Average Efficiency:</span> {avgEfficiency}%
              </div>
              <div>
                <span className="font-semibold">Combined Output:</span> {totalProduction.toFixed(1)} kW
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-4 w-4" />
              Weather Impact
            </CardTitle>
            <CardDescription>Current conditions affecting generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Sky Condition</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Partly Cloudy</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Temperature</span>
                <span className="font-semibold">78°F (Optimal)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">UV Index</span>
                <span className="font-semibold">7 (High)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Generation Efficiency</span>
                <span className="font-semibold text-green-600">94%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-4 w-4" />
              Energy Storage
            </CardTitle>
            <CardDescription>Solar to battery performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Battery Level</span>
                <span className="font-semibold">87%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Charging Rate</span>
                <span className="font-semibold text-green-600">+2.5 kW</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Storage Efficiency</span>
                <span className="font-semibold">96%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Estimated Full</span>
                <span className="font-semibold">2.3 hours</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>July 2025 performance overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">840 kWh</div>
              <div className="text-sm text-muted-foreground">Total Generated</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">$1,260</div>
              <div className="text-sm text-muted-foreground">Money Saved</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">98%</div>
              <div className="text-sm text-muted-foreground">System Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">4.2 tons</div>
              <div className="text-sm text-muted-foreground">CO2 Avoided</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 