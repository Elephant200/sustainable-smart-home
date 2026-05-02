"use client";

import { Suspense } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, TrendingUp, CloudSun, Battery, Zap, Leaf, DollarSign } from "lucide-react";
import { SolarGenerationChart } from "@/components/visualizations/solar-generation-chart";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useSolarPanels } from "@/lib/hooks/use-energy-data";
import type { SolarPanelsResponse } from "@/lib/hooks/use-energy-data";

type PanelData = SolarPanelsResponse["arrays"][number]["panels"][number];

function SolarPanelIcon({ panel }: { panel: PanelData }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "text-primary bg-primary/10 border-primary/30";
      case "good": return "text-warning bg-warning/10 border-warning/30";
      case "maintenance": return "text-chart-3 bg-chart-3/10 border-chart-3/30";
      default: return "text-muted-foreground bg-muted/40 border-border";
    }
  };
  return (
    <div className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${getStatusColor(panel.status)}`}>
      <div className="flex flex-col items-center space-y-1">
        <Sun className="h-8 w-8" />
        <div className="text-sm font-bold">{panel.production_kw.toFixed(2)} kW</div>
        <div className="text-xs opacity-75">{panel.efficiency_pct}%</div>
        <div className="absolute -top-2 -left-2 bg-card rounded-full px-2 py-1 text-xs font-semibold border shadow-sm">
          #{panel.panel_id}
        </div>
      </div>
    </div>
  );
}

export default function SolarPage() {
  const { data, loading, error } = useSolarPanels();

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonChartCard height={120} />
        <SkeletonChartCard height={300} />
      </div>
    );
  }

  if (error || !data || data.arrays.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Solar Power System</CardTitle>
          <CardDescription>
            {error
              ? "Unable to load solar data."
              : "No solar arrays are configured. Add one in Settings to see live panel performance."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { arrays, summary } = data;
  const allPanels = arrays.flatMap((a) => a.panels);
  const totalCurrent = arrays.reduce((s, a) => s + a.current_kw, 0);
  const avgEfficiency = Math.round(
    allPanels.reduce((s, p) => s + p.efficiency_pct, 0) / Math.max(1, allPanels.length)
  );
  const weatherPct = Math.round((arrays[0]?.weather_factor ?? 1) * 100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solar Power System</CardTitle>
          <CardDescription>
            Monitor your {allPanels.length}-panel solar array performance and energy generation in real-time
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-chart-1" />
              Current Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-1">{totalCurrent.toFixed(2)} kW</div>
            <div className="text-sm text-muted-foreground">Real-time generation</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Today&apos;s Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {summary.solar_today_kwh.toFixed(1)} kWh
            </div>
            <div className="text-sm text-primary">{summary.solar_month_mwh} MWh this month</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-chart-2" />
              Savings Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-2">${summary.daily_savings_usd.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Energy cost avoided</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              CO₂ Reduced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {summary.carbon_reduced_tons_month} tons
            </div>
            <div className="text-sm text-muted-foreground">This month</div>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<SkeletonChartCard height={300} />}>
        <SolarGenerationChart />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Individual Panel Performance
          </CardTitle>
          <CardDescription>
            Real-time output from each of your {allPanels.length} solar panels
          </CardDescription>
          <CardAction>
            <Badge variant="default" className="bg-primary/15 text-primary border-primary/30">
              {allPanels.every((p) => p.status !== "maintenance")
                ? "All Systems Operational"
                : "Maintenance Recommended"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {allPanels.map((panel) => (
              <SolarPanelIcon key={panel.panel_id} panel={panel} />
            ))}
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Total Panels:</span> {allPanels.length}
              </div>
              <div>
                <span className="font-semibold">Average Efficiency:</span> {avgEfficiency}%
              </div>
              <div>
                <span className="font-semibold">Combined Output:</span> {totalCurrent.toFixed(2)} kW
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
                <span className="text-sm">Weather Factor</span>
                <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/30">
                  {weatherPct >= 80 ? "Clear" : weatherPct >= 50 ? "Partly Cloudy" : "Overcast"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Solar Conditions</span>
                <span className="font-semibold">{weatherPct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Generation Efficiency</span>
                <span className="font-semibold text-primary">{avgEfficiency}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Active Output</span>
                <span className="font-semibold text-chart-1">{totalCurrent.toFixed(2)} kW</span>
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
                <span className="text-sm">Battery Stored</span>
                <span className="font-semibold">{summary.battery_stored_kwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Storage Efficiency</span>
                <span className="font-semibold">{summary.storage_efficiency_pct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid Independence</span>
                <span className="font-semibold">{summary.grid_independence_pct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Monthly Savings</span>
                <span className="font-semibold text-primary">${summary.monthly_savings_usd.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>Current month performance overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-chart-1">{summary.solar_month_mwh} MWh</div>
              <div className="text-sm text-muted-foreground">Total Generated</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">${summary.monthly_savings_usd.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Money Saved</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-chart-2">{summary.uptime_pct}%</div>
              <div className="text-sm text-muted-foreground">System Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{summary.carbon_reduced_tons_month} tons</div>
              <div className="text-sm text-muted-foreground">CO₂ Avoided</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
