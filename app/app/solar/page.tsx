"use client";

import { Suspense } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sun, TrendingUp, CloudSun, Battery, Zap, Leaf, DollarSign } from "lucide-react";
import { SolarGenerationChart } from "@/components/visualizations/solar-generation-chart";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useSolarPanels } from "@/lib/hooks/use-energy-data";
import type { SolarPanelsResponse } from "@/lib/hooks/use-energy-data";

type ArrayData = SolarPanelsResponse["arrays"][number];

function statusBadge(status: ArrayData["status"]) {
  if (status === "optimal")
    return <Badge className="bg-primary/15 text-primary border-primary/30">Optimal</Badge>;
  if (status === "good")
    return <Badge className="bg-warning/15 text-warning border-warning/30">Good</Badge>;
  return <Badge className="bg-chart-3/15 text-chart-3 border-chart-3/30">Maintenance</Badge>;
}

function statusBorder(status: ArrayData["status"]): string {
  if (status === "optimal") return "border-primary/30";
  if (status === "good") return "border-warning/30";
  return "border-chart-3/30";
}

function SolarArrayCard({ array }: { array: ArrayData }) {
  return (
    <Card className={`border-2 ${statusBorder(array.status)}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-chart-1" />
            {array.name}
          </div>
          {statusBadge(array.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm">
            <span>Output</span>
            <span className="font-semibold">
              {array.current_kw.toFixed(2)} / {array.rated_kw.toFixed(2)} kW
            </span>
          </div>
          <Progress value={array.efficiency_pct} className="h-2 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Panels</div>
            <div className="font-semibold">{array.panel_count}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Per-Panel Rating</div>
            <div className="font-semibold">{array.output_per_panel_kw} kW</div>
          </div>
          <div>
            <div className="text-muted-foreground">Efficiency</div>
            <div className="font-semibold">{array.efficiency_pct}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Weather Factor</div>
            <div className="font-semibold">{Math.round(array.weather_factor * 100)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
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
              : "No solar arrays are configured. Add one in Settings to see live performance."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { arrays, summary } = data;
  const totalPanels = arrays.reduce((s, a) => s + a.panel_count, 0);
  const totalCurrent = arrays.reduce((s, a) => s + a.current_kw, 0);
  const totalRated = arrays.reduce((s, a) => s + a.rated_kw, 0);
  const avgEfficiency =
    arrays.length > 0
      ? Math.round(arrays.reduce((s, a) => s + a.efficiency_pct, 0) / arrays.length)
      : 0;
  // Average weather factor across arrays — handles N arrays uniformly.
  const avgWeather =
    arrays.length > 0
      ? arrays.reduce((s, a) => s + a.weather_factor, 0) / arrays.length
      : 1;
  const weatherPct = Math.round(avgWeather * 100);

  const headerSubtitle =
    arrays.length === 1
      ? `Monitor your ${totalPanels}-panel solar array (${totalRated.toFixed(2)} kW rated)`
      : `Monitor your ${arrays.length} solar arrays (${totalPanels} panels, ${totalRated.toFixed(2)} kW rated)`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solar Power System</CardTitle>
          <CardDescription>{headerSubtitle}</CardDescription>
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
            {arrays.length === 1 ? "Array Performance" : "Array Performance"}
          </CardTitle>
          <CardDescription>Real-time output from each of your solar arrays</CardDescription>
          <CardAction>
            <Badge variant="outline">
              {arrays.length} {arrays.length === 1 ? "array" : "arrays"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {arrays.map((a) => (
              <SolarArrayCard key={a.id} array={a} />
            ))}
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
                <span className="text-sm">Weather Conditions</span>
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
