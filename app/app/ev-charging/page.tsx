"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Car, Calendar, Zap, DollarSign, Battery, Leaf, Settings } from "lucide-react";
import { EVChargingChart } from "@/components/visualizations/ev-charging-chart-lazy";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useEv } from "@/lib/hooks/use-energy-data";
import type { EvResponse } from "@/lib/hooks/use-energy-data";

type Vehicle = EvResponse["vehicles"][number];

function EVStatusCard({ vehicle }: { vehicle: Vehicle }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "charging": return "text-primary bg-primary/10 border-primary/30";
      case "completed": return "text-chart-2 bg-chart-2/10 border-chart-2/30";
      case "disconnected": return "text-muted-foreground bg-muted/40 border-border";
      default: return "text-muted-foreground bg-muted/40 border-border";
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "charging": return <Badge className="bg-primary/15 text-primary border-primary/30">Charging</Badge>;
      case "completed": return <Badge className="bg-chart-2/15 text-chart-2 border-chart-2/30">Completed</Badge>;
      case "disconnected": return <Badge variant="outline">Disconnected</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };
  return (
    <Card className={`border-2 ${getStatusColor(vehicle.charging_status)}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {vehicle.name}
          </div>
          {getStatusBadge(vehicle.charging_status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Battery Level</span>
            <span className="font-semibold">{vehicle.battery_level_pct}%</span>
          </div>
          <Progress value={vehicle.battery_level_pct} className="h-2" />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Range</span>
            <div className="font-semibold">{vehicle.range_mi} mi</div>
          </div>
          <div>
            <span className="text-muted-foreground">Charge Rate</span>
            <div className="font-semibold">{vehicle.charge_rate_kw} kW</div>
          </div>
          <div>
            <span className="text-muted-foreground">Time to Full</span>
            <div className="font-semibold">{vehicle.time_to_full_label}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Efficiency</span>
            <div className="font-semibold">{vehicle.efficiency}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last update: {vehicle.last_charged_label}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EVChargingPage() {
  const { data, loading, error } = useEv();

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonChartCard height={120} />
        <SkeletonChartCard height={300} />
      </div>
    );
  }

  if (error || !data || data.vehicles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Electric Vehicle Charging</CardTitle>
          <CardDescription>
            {error
              ? "Unable to load EV data."
              : "No electric vehicles are configured. Add one in Settings to see charging status here."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { vehicles, summary } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Electric Vehicle Charging</CardTitle>
          <CardDescription>
            Smart EV charging with solar integration and cost optimization for your {vehicles.length} vehicle
            {vehicles.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-chart-1" />
              Current Charging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-1">{summary.current_total_kw.toFixed(1)} kW</div>
            <div className="text-sm text-muted-foreground">
              {summary.charging_count} vehicle(s) charging
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-chart-2" />
              Energy Used (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-2">{summary.energy_today_kwh} kWh</div>
            <div className="text-sm text-muted-foreground">Last 24 hours</div>
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
            <div className="text-3xl font-bold text-primary">${summary.cost_savings_usd.toFixed(2)}</div>
            <div className="text-sm text-primary">vs peak rate charging</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              Clean Energy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary.clean_energy_pct}%</div>
            <div className="text-sm text-muted-foreground">Solar + battery powered</div>
          </CardContent>
        </Card>
      </div>

      <EVChargingChart />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Vehicle Status</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vehicles.map((vehicle) => (
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
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehicles.map((v) => (
                <div className="flex justify-between items-center" key={v.id}>
                  <span className="text-sm">{v.name}</span>
                  <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/30">
                    {v.schedule_window_label}
                  </Badge>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <span className="text-sm">Priority Mode</span>
                <Badge variant="default" className="bg-chart-5/15 text-chart-5">
                  {summary.priority_mode_label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Off-Peak Hours</span>
                <span className="font-semibold">{summary.off_peak_window_label}</span>
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
                <span className="text-sm">Solar / Battery</span>
                <span className="font-semibold">{summary.clean_energy_pct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid (Off-Peak)</span>
                <span className="font-semibold">{Math.max(0, 100 - summary.clean_energy_pct)}%</span>
              </div>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="text-sm font-semibold text-primary">
                  {summary.clean_energy_pct}% renewable energy used
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>Current month EV charging performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-chart-2">{summary.month_energy_mwh} MWh</div>
              <div className="text-sm text-muted-foreground">Energy Consumed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">${summary.cost_savings_usd.toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Cost Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-chart-5">{summary.clean_energy_pct}%</div>
              <div className="text-sm text-muted-foreground">Solar Powered</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
