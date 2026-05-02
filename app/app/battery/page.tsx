"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Battery, Zap, Settings, Heart, TrendingUp, Clock, Shield, Thermometer, ArrowUp, ArrowDown } from "lucide-react";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useBattery } from "@/lib/hooks/use-energy-data";
import type { BatteryResponse } from "@/lib/hooks/use-energy-data";

type ModuleData = BatteryResponse["modules"][number];

function BatteryModuleIcon({ module }: { module: ModuleData }) {
  const getChargeColor = (charge: number) => {
    if (charge >= 80) return "text-primary bg-primary/10 border-primary/30";
    if (charge >= 60) return "text-chart-2 bg-chart-2/10 border-chart-2/30";
    if (charge >= 40) return "text-warning bg-warning/10 border-warning/30";
    return "text-chart-3 bg-chart-3/10 border-chart-3/30";
  };
  const getStatusIcon = (status: string) => {
    if (status === "charging") return <ArrowUp className="h-3 w-3 text-primary" />;
    if (status === "discharging") return <ArrowDown className="h-3 w-3 text-chart-3" />;
    return <Zap className="h-3 w-3 text-muted-foreground" />;
  };
  return (
    <div className={`relative p-4 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${getChargeColor(module.charge_pct)}`}>
      <div className="flex flex-col items-center space-y-2">
        <Battery className="h-8 w-8" />
        <div className="text-lg font-bold">{module.charge_pct}%</div>
        <div className="text-xs opacity-75">{module.capacity_kwh} kWh</div>
        <div className="flex items-center gap-1 text-xs">
          {getStatusIcon(module.status)}
          <span>{Math.abs(module.power_kw).toFixed(1)} kW</span>
        </div>
        <Progress value={module.charge_pct} className="w-full h-1" />
        <div className="absolute -top-2 -left-2 bg-card rounded-full px-2 py-1 text-xs font-semibold border shadow-sm">
          #{module.id}
        </div>
      </div>
    </div>
  );
}

export default function BatteryPage() {
  const { data, loading, error } = useBattery();

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonChartCard height={120} />
        <SkeletonChartCard height={400} />
      </div>
    );
  }

  if (error || !data?.battery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Battery Energy Storage System</CardTitle>
          <CardDescription>
            {error
              ? "Unable to load battery data."
              : "No battery storage device is configured for your account. Add one in Settings to see live status here."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { battery, modules, history } = data;
  const isCharging = battery.power_kw > 0.05;
  const avgHealth = Math.round(
    modules.reduce((s, m) => s + m.health_pct, 0) / Math.max(1, modules.length)
  );
  const avgTemp =
    modules.reduce((s, m) => s + m.temperature_f, 0) / Math.max(1, modules.length);
  const lastDischargeKwh = history
    .filter((h) => h.power_kw < 0)
    .reduce((s, h) => s + -h.power_kw, 0);
  const backupHours =
    battery.critical_load_kw > 0
      ? battery.soc_kwh / battery.critical_load_kw
      : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Battery Energy Storage System</CardTitle>
          <CardDescription>
            Monitor your {modules.length}-module {battery.name} system with {battery.capacity_kwh} kWh total capacity
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-chart-2" />
              State of Charge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-2">{Math.round(battery.soc_percent)}%</div>
            <div className="text-sm text-muted-foreground">{battery.soc_kwh.toFixed(1)} kWh stored</div>
            <Progress value={battery.soc_percent} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Power Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {battery.power_kw >= 0 ? "+" : ""}{battery.power_kw.toFixed(2)} kW
            </div>
            <div className="text-sm text-primary flex items-center gap-1">
              {isCharging ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {isCharging ? "Charging" : battery.power_kw < -0.05 ? "Discharging" : "Idle"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-chart-5" />
              {isCharging ? "Time to Full" : "Backup Time"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-5">
              {isCharging
                ? `${battery.hours_to_full.toFixed(1)} hrs`
                : `${backupHours.toFixed(1)} hrs`}
            </div>
            <div className="text-sm text-muted-foreground">
              {isCharging
                ? "At current charge rate"
                : `At ${battery.critical_load_kw.toFixed(1)} kW critical loads`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{battery.health_pct}%</div>
            <div className="text-sm text-muted-foreground">{battery.health_label}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            Individual Battery Modules
          </CardTitle>
          <CardDescription>
            Real-time status of each {modules[0]?.capacity_kwh ?? 0} kWh unit
          </CardDescription>
          <CardAction>
            <Badge variant="default" className="bg-primary/15 text-primary border-primary/30">
              {isCharging ? "All Modules Charging" : battery.power_kw < -0.05 ? "Discharging" : "Idle"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((module) => (
              <BatteryModuleIcon key={module.id} module={module} />
            ))}
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Total Capacity:</span> {battery.capacity_kwh} kWh
              </div>
              <div>
                <span className="font-semibold">Energy Stored:</span> {battery.soc_kwh.toFixed(1)} kWh
              </div>
              <div>
                <span className="font-semibold">Current Power:</span> {battery.power_kw >= 0 ? "+" : ""}
                {battery.power_kw.toFixed(2)} kW
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
                <span className="text-sm">Energy Stored Today</span>
                <span className="font-semibold">{battery.charged_today_kwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Energy Released Today</span>
                <span className="font-semibold">{battery.discharged_today_kwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Net Storage</span>
                <span className="font-semibold text-primary">
                  {(battery.charged_today_kwh - battery.discharged_today_kwh) >= 0 ? "+" : ""}
                  {(battery.charged_today_kwh - battery.discharged_today_kwh).toFixed(1)} kWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Round-trip Efficiency</span>
                <span className="font-semibold">{battery.round_trip_efficiency_pct}%</span>
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
                <span className="font-semibold">{avgTemp.toFixed(1)}°F</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cooling Status</span>
                <Badge
                  variant="outline"
                  className={
                    battery.cooling_active
                      ? "bg-chart-2/10 text-chart-2 border-chart-2/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {battery.cooling_active ? "Active" : "Standby"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Module Health (avg)</span>
                <span className="font-semibold">{avgHealth}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Max Power Rating</span>
                <span className="font-semibold">{battery.max_flow_kw} kW</span>
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
                <Badge
                  variant={battery.tou_enabled ? "default" : "outline"}
                  className={battery.tou_enabled ? "bg-primary/15 text-primary" : ""}
                >
                  {battery.tou_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Peak Shaving</span>
                <Badge
                  variant={battery.peak_shaving_enabled ? "default" : "outline"}
                  className={battery.peak_shaving_enabled ? "bg-chart-2/15 text-chart-2" : ""}
                >
                  {battery.peak_shaving_enabled ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Reserve Floor</span>
                <span className="font-semibold">{battery.reserve_floor_pct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid Services</span>
                <Badge variant="outline">
                  {battery.grid_services_enabled ? "Available" : "Unavailable"}
                </Badge>
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
                <span className="text-sm">Available Backup</span>
                <span className="font-semibold">{battery.available_backup_kwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Discharge Today</span>
                <span className="font-semibold">{lastDischargeKwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Backup Mode</span>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {battery.backup_mode_label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Grid Connection</span>
                <Badge variant="default" className="bg-primary/15 text-primary">
                  {battery.grid_connection_label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
