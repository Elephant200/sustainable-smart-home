"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Leaf, BarChart3, Zap, Sun, Battery, Car, Target, Award } from "lucide-react";
import { EnergyFlowChart } from "@/components/visualizations/energy-flow-chart-lazy";
import { MonthlyTrendsChart } from "@/components/visualizations/monthly-trends-chart-lazy";
import { CostSavingsChart } from "@/components/visualizations/cost-savings-chart-lazy";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useAnalytics, useSnapshot } from "@/lib/hooks/use-energy-data";

export default function AnalyticsPage() {
  const { data: analytics, loading: aLoading } = useAnalytics();
  const { data: snap, loading: sLoading } = useSnapshot();

  if (aLoading || sLoading) {
    return (
      <div className="space-y-6">
        <SkeletonChartCard height={120} />
        <SkeletonChartCard height={400} />
      </div>
    );
  }
  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Performance Insights</CardTitle>
          <CardDescription>Unable to load analytics data.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const s = analytics.summary;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Performance Insights</CardTitle>
          <CardDescription>
            Comprehensive analysis of your sustainable smart home&apos;s energy performance, cost savings, and environmental impact
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-chart-1" />
              Energy Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-1">{s.solar_current_kw.toFixed(2)} kW</div>
            <div className="text-sm text-muted-foreground">Current solar generation</div>
            <div className="mt-2 text-sm">
              <span className="text-chart-2 font-semibold">
                {snap?.devices.battery
                  ? `${snap.devices.battery.soc_kwh.toFixed(1)} kWh`
                  : "—"}
              </span>{" "}
              stored
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Monthly Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">${s.monthly_savings_usd.toLocaleString()}</div>
            <div
              className={`text-sm ${
                s.month_over_month_savings_pct >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {s.prev_month_savings_usd > 0
                ? `${s.month_over_month_savings_pct >= 0 ? "+" : ""}${s.month_over_month_savings_pct}% vs last month`
                : "No prior month data"}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              ${s.annual_savings_usd.toLocaleString()} annual
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              Carbon Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{s.carbon_reduced_tons_month} tons</div>
            <div className="text-sm text-muted-foreground">CO₂ reduced this month</div>
            <div className="mt-2 text-sm text-primary">
              {s.carbon_reduced_tons_year} tons/year
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-chart-5" />
              Grid Independence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-5">{s.grid_independence_pct}%</div>
            <div className="text-sm text-muted-foreground">Energy self-sufficiency</div>
            <Progress value={s.grid_independence_pct} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <EnergyFlowChart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendsChart />
        <CostSavingsChart />
      </div>

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
              <span className="font-semibold">{s.solar_month_mwh} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Today</span>
              <span className="font-semibold">{s.solar_today_kwh} kWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Current Output</span>
              <span className="font-semibold">{s.solar_current_kw.toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Uptime</span>
              <Badge variant="default" className="bg-primary/15 text-primary">{s.uptime_pct}%</Badge>
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
              <span className="text-sm">Energy Cycled (mo)</span>
              <span className="font-semibold">{s.battery_month_mwh} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Round-trip Efficiency</span>
              <span className="font-semibold">{s.battery_round_trip_efficiency_pct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Current SOC</span>
              <span className="font-semibold">
                {snap?.devices.battery
                  ? `${Math.round(snap.devices.battery.soc_percent)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Health Score</span>
              <Badge variant="default" className="bg-chart-2/15 text-chart-2">{s.battery_health_pct}%</Badge>
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
              <span className="text-sm">Energy Used (mo)</span>
              <span className="font-semibold">{s.ev_month_mwh} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Vehicles</span>
              <span className="font-semibold">{snap?.counts.ev ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">House Load (mo)</span>
              <span className="font-semibold">{s.house_month_mwh} MWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Smart Charging</span>
              <Badge
                variant={(snap?.counts.ev ?? 0) > 0 ? "default" : "outline"}
                className={(snap?.counts.ev ?? 0) > 0 ? "bg-chart-5/15 text-chart-5" : ""}
              >
                {(snap?.counts.ev ?? 0) > 0 ? "Active" : "No EVs"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <span>Grid Independence</span>
                <span className="font-semibold">{s.grid_independence_pct}%</span>
              </div>
              <Progress value={s.grid_independence_pct} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>System Uptime</span>
                <span className="font-semibold">{s.uptime_pct}%</span>
              </div>
              <Progress value={s.uptime_pct} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Battery Health</span>
                <span className="font-semibold">{s.battery_health_pct}%</span>
              </div>
              <Progress value={s.battery_health_pct} className="h-2" />
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
                <div className={`w-2 h-2 rounded-full ${s.grid_independence_pct >= 70 ? "bg-primary" : "bg-warning"}`} />
                <span className="text-sm">70% Grid Independence</span>
              </div>
              <Badge
                variant={s.grid_independence_pct >= 70 ? "default" : "outline"}
                className={s.grid_independence_pct >= 70 ? "bg-primary/15 text-primary" : ""}
              >
                {s.grid_independence_pct >= 70 ? "Achieved" : "In Progress"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${s.carbon_reduced_tons_year >= 5 ? "bg-primary" : "bg-warning"}`} />
                <span className="text-sm">5 tons CO₂ / year</span>
              </div>
              <Badge
                variant={s.carbon_reduced_tons_year >= 5 ? "default" : "outline"}
                className={s.carbon_reduced_tons_year >= 5 ? "bg-primary/15 text-primary" : ""}
              >
                {s.carbon_reduced_tons_year >= 5 ? "Achieved" : "In Progress"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-warning rounded-full" />
                <span className="text-sm">${s.annual_savings_usd >= 40000 ? "40K+" : "40K"} Annual Savings</span>
              </div>
              <Badge variant={s.annual_savings_usd >= 40000 ? "default" : "outline"}>
                {s.annual_savings_usd >= 40000 ? "Achieved" : "In Progress"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full" />
                <span className="text-sm">80% Grid Independence</span>
              </div>
              <Badge variant="outline">Upcoming</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{new Date().getFullYear()} Annual Summary</CardTitle>
          <CardDescription>
            Year-to-date performance through {new Date().toLocaleString("en-US", { month: "long" })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-chart-1">{s.ytd_solar_mwh} MWh</div>
              <div className="text-sm text-muted-foreground">Solar Generated</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">${s.ytd_savings_usd.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{s.ytd_carbon_tons} tons</div>
              <div className="text-sm text-muted-foreground">Carbon Avoided</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-chart-2">{s.uptime_pct}%</div>
              <div className="text-sm text-muted-foreground">System Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
