"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Battery, Zap, Heart, TrendingUp, Clock, Shield, ArrowUp, ArrowDown } from "lucide-react";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useBattery } from "@/lib/hooks/use-energy-data";
import type { BatteryResponse } from "@/lib/hooks/use-energy-data";

type DeviceData = BatteryResponse["devices"][number];

function statusColor(status: DeviceData["status"]): string {
  if (status === "charging") return "text-primary bg-primary/10 border-primary/30";
  if (status === "discharging") return "text-chart-3 bg-chart-3/10 border-chart-3/30";
  return "text-muted-foreground bg-muted/40 border-border";
}

function statusBadge(status: DeviceData["status"]) {
  if (status === "charging") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30">
        <ArrowUp className="h-3 w-3 mr-1" /> Charging
      </Badge>
    );
  }
  if (status === "discharging") {
    return (
      <Badge className="bg-chart-3/15 text-chart-3 border-chart-3/30">
        <ArrowDown className="h-3 w-3 mr-1" /> Discharging
      </Badge>
    );
  }
  return <Badge variant="outline">Idle</Badge>;
}

function BatteryDeviceCard({ device }: { device: DeviceData }) {
  return (
    <Card className={`border-2 ${statusColor(device.status)}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            {device.name}
          </div>
          {statusBadge(device.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm">
            <span>State of Charge</span>
            <span className="font-semibold">{Math.round(device.soc_percent)}%</span>
          </div>
          <Progress value={device.soc_percent} className="h-2 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Energy Stored</div>
            <div className="font-semibold">{device.soc_kwh.toFixed(1)} kWh</div>
          </div>
          <div>
            <div className="text-muted-foreground">Capacity</div>
            <div className="font-semibold">{device.capacity_kwh.toFixed(1)} kWh</div>
          </div>
          <div>
            <div className="text-muted-foreground">Current Power</div>
            <div className="font-semibold">
              {device.power_kw >= 0 ? "+" : ""}
              {device.power_kw.toFixed(2)} kW
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Max Power</div>
            <div className="font-semibold">{device.max_flow_kw} kW</div>
          </div>
        </div>
      </CardContent>
    </Card>
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

  const { battery, devices, history } = data;
  const isCharging = battery.power_kw > 0.05;
  const lastDischargeKwh = history
    .filter((h) => h.power_kw < 0)
    .reduce((s, h) => s + -h.power_kw, 0);
  const backupHours =
    battery.critical_load_kw > 0
      ? battery.soc_kwh / battery.critical_load_kw
      : 0;

  const headerSubtitle =
    devices.length === 1
      ? `Monitor your ${battery.name} system with ${battery.capacity_kwh.toFixed(1)} kWh capacity`
      : `Monitor your ${devices.length} battery units totaling ${battery.capacity_kwh.toFixed(1)} kWh capacity`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Battery Energy Storage System</CardTitle>
          <CardDescription>{headerSubtitle}</CardDescription>
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
            <div className="text-sm text-muted-foreground">
              {battery.soc_kwh.toFixed(1)} of {battery.capacity_kwh.toFixed(1)} kWh
            </div>
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
              {battery.health_pct != null ? "System Health" : "Reserve"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {battery.health_pct != null ? (
              <>
                <div className="text-3xl font-bold text-primary">{battery.health_pct}%</div>
                <div className="text-sm text-muted-foreground">
                  {battery.health_label ?? ""}
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-primary">
                  {battery.reserve_kwh.toFixed(1)} kWh
                </div>
                <div className="text-sm text-muted-foreground">
                  {battery.reserve_floor_pct}% reserve floor
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            {devices.length === 1 ? "Battery Unit" : "Battery Units"}
          </CardTitle>
          <CardDescription>
            Real-time status of each battery in your system
          </CardDescription>
          <CardAction>
            <Badge variant="outline">
              {devices.length} {devices.length === 1 ? "device" : "devices"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {devices.map((d) => (
              <BatteryDeviceCard key={d.id} device={d} />
            ))}
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
                <span className="text-sm">Reserve Floor</span>
                <span className="font-semibold">{battery.reserve_floor_pct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Discharged Today</span>
                <span className="font-semibold">{lastDischargeKwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Backup Mode</span>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {battery.backup_mode_label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
