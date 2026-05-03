"use client";

import { Suspense } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap, Activity, Settings2, Sun, Battery, Car, DollarSign } from "lucide-react";
import { CarbonIntensityChart } from "@/components/visualizations/carbon-intensity-chart";
import { HouseLoadChart } from "@/components/visualizations/house-load-chart";
import { EnergyFlowDiagram } from "@/components/visualizations/energy-flow-diagram-lazy";
import { Skeleton, SkeletonChartCard } from "@/components/ui/skeleton";
import { DisconnectedBanner } from "@/components/dashboard/disconnected-banner";
import Link from "next/link";
import { useSnapshot, useAnalytics, useAlerts } from "@/lib/hooks/use-energy-data";

function MetricValue({
  loading,
  value,
  className,
}: {
  loading: boolean;
  value: string;
  className?: string;
}) {
  if (loading) return <Skeleton className="h-8 w-24" />;
  return <div className={`text-2xl font-bold ${className ?? ""}`}>{value}</div>;
}

function InlineSkeleton({ width = "w-16" }: { width?: string }) {
  return <Skeleton className={`inline-block h-4 ${width} align-middle`} />;
}

export default function DashboardPage() {
  const { data: snap, loading: snapLoading } = useSnapshot();
  const { data: analytics, loading: analyticsLoading } = useAnalytics();
  const { data: alerts, loading: alertsLoading } = useAlerts();

  const solarKw = snap?.flows.solar_kw ?? 0;
  const solarToday = analytics?.summary.solar_today_kwh ?? 0;
  const battery = snap?.devices.battery;
  const ev = snap?.devices.ev?.[0];
  const housePower = snap?.flows.house_kw ?? 0;
  const gridPower = snap?.flows.grid_kw ?? 0;
  const independence = analytics?.summary.grid_independence_pct ?? 0;
  const dailySavings = analytics?.summary.daily_savings_usd ?? 0;
  const monthlySavings = analytics?.summary.monthly_savings_usd ?? 0;
  const carbonReduced = analytics?.summary.carbon_reduced_tons_month ?? 0;
  const systemHealth = analytics?.summary.system_health_pct ?? 0;
  const systemStatusLabel =
    systemHealth >= 95 ? "Optimal" : systemHealth >= 85 ? "Healthy" : "Attention";
  const activeAlerts =
    alerts?.alerts.filter((a) => a.status === "active").length ?? 0;

  return (
    <div className="space-y-6">
      <DisconnectedBanner />
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Real-time energy monitoring and control for your sustainable smart home
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="h-5 w-5 text-chart-1" />
              Solar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricValue
              loading={snapLoading}
              value={`${solarKw.toFixed(2)} kW`}
              className="text-chart-1"
            />
            <div className="text-sm text-muted-foreground">Generating now</div>
            <div className="text-xs text-primary mt-1">
              {analyticsLoading ? <InlineSkeleton width="w-24" /> : `${solarToday.toFixed(1)} kWh today`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-chart-2" />
              Battery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricValue
              loading={snapLoading}
              value={battery ? `${Math.round(battery.soc_percent)}%` : "—"}
              className="text-chart-2"
            />
            <div className="text-sm text-muted-foreground">
              {battery
                ? `${battery.power_kw >= 0 ? "+" : ""}${battery.power_kw.toFixed(2)} kW`
                : "No battery"}
            </div>
            <Progress value={battery?.soc_percent ?? 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5 text-chart-5" />
              EV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricValue
              loading={snapLoading}
              value={ev ? `${ev.charge_rate_kw.toFixed(2)} kW` : "—"}
              className="text-chart-5"
            />
            <div className="text-sm text-muted-foreground">
              {ev ? `${ev.name}` : "No vehicle"}
            </div>
            <div className="text-xs text-chart-2 mt-1">
              {ev ? `${Math.round(ev.soc_percent)}% charged` : ""}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricValue
              loading={analyticsLoading}
              value={`$${dailySavings.toFixed(2)}`}
              className="text-primary"
            />
            <div className="text-sm text-muted-foreground">Today</div>
            <div className="text-xs text-primary mt-1">
              {analyticsLoading ? (
                <InlineSkeleton width="w-32" />
              ) : (
                `$${monthlySavings.toLocaleString()} this month`
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EnergyFlowDiagram />

      <Suspense fallback={<SkeletonChartCard height={250} />}>
        <CarbonIntensityChart />
      </Suspense>

      <Suspense fallback={<SkeletonChartCard height={250} />}>
        <HouseLoadChart />
      </Suspense>

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
              <span className="font-semibold">
                {snapLoading ? <InlineSkeleton /> : `${housePower.toFixed(2)} kW`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                {gridPower < 0 ? "Grid Export" : "Grid Import"}
              </span>
              <span className="font-semibold text-primary">
                {snapLoading ? <InlineSkeleton /> : `${Math.abs(gridPower).toFixed(2)} kW`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Self-Sufficiency</span>
              <span className="font-semibold">
                {analyticsLoading ? <InlineSkeleton width="w-12" /> : `${independence}%`}
              </span>
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
              <Badge variant="default" className="bg-primary/15 text-primary">
                {analyticsLoading ? <InlineSkeleton width="w-16" /> : systemStatusLabel}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">System Health</span>
              <span className="font-semibold text-primary">
                {analyticsLoading ? <InlineSkeleton width="w-12" /> : `${systemHealth}%`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Alerts</span>
              <Badge variant="outline" className="bg-chart-2/10 text-chart-2">
                {alertsLoading ? <InlineSkeleton width="w-6" /> : activeAlerts}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">CO₂ Reduced</span>
              <span className="font-semibold text-primary">
                {analyticsLoading ? <InlineSkeleton width="w-20" /> : `${carbonReduced} tons/mo`}
              </span>
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
