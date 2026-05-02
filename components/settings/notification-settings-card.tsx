"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Notification preferences are stored locally in the browser. There is no
 * server-side notification preferences table yet, so persisting to
 * `localStorage` is the honest implementation: each toggle reflects and
 * controls a real user setting on this device. When a backend column is
 * added, swap the read/write hooks for an API call without changing the UI.
 */

const STORAGE_KEY = "ecohome:notif-prefs:v1";

type Channel = "ev_charging" | "battery_status" | "solar_performance" |
  "cost_savings" | "maintenance" | "efficiency_warnings" |
  "weather_impact" | "grid_events";

const CHANNELS: { id: Channel; group: string; title: string; subtitle: string }[] = [
  { id: "ev_charging", group: "System Alerts", title: "EV Charging Alerts",
    subtitle: "Notifications for charging start, completion, and issues" },
  { id: "battery_status", group: "System Alerts", title: "Battery Status",
    subtitle: "Battery charge level and health updates" },
  { id: "solar_performance", group: "System Alerts", title: "Solar Performance",
    subtitle: "Solar generation and efficiency alerts" },
  { id: "cost_savings", group: "System Alerts", title: "Cost Savings",
    subtitle: "Daily and monthly savings achievements" },
  { id: "maintenance", group: "System Alerts", title: "Maintenance Reminders",
    subtitle: "Scheduled maintenance and cleaning alerts" },
  { id: "efficiency_warnings", group: "Performance Notifications", title: "Efficiency Warnings",
    subtitle: "System efficiency drops below threshold" },
  { id: "weather_impact", group: "Performance Notifications", title: "Weather Impact",
    subtitle: "Weather conditions affecting solar generation" },
  { id: "grid_events", group: "Performance Notifications", title: "Grid Events",
    subtitle: "Power outages and grid connection status" },
];

const DEFAULTS: Record<Channel, boolean> = {
  ev_charging: true,
  battery_status: true,
  solar_performance: true,
  cost_savings: false,
  maintenance: true,
  efficiency_warnings: true,
  weather_impact: true,
  grid_events: true,
};

function loadPrefs(): Record<Channel, boolean> {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<Channel, boolean>>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: Record<Channel, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable (private mode, quota); preferences
    // simply won't persist across sessions in that case.
  }
}

export function NotificationSettingsCard() {
  const [prefs, setPrefs] = useState<Record<Channel, boolean>>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setHydrated(true);
  }, []);

  const toggle = (id: Channel, value: boolean) => {
    const next = { ...prefs, [id]: value };
    setPrefs(next);
    savePrefs(next);
  };

  const groups = Array.from(new Set(CHANNELS.map((c) => c.group)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Configure alert preferences. Saved on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => (
          <div key={group} className="space-y-4">
            <h4 className="text-sm font-semibold">{group}</h4>
            <div className="space-y-4">
              {CHANNELS.filter((c) => c.group === group).map((c) => (
                <div key={c.id} className="flex justify-between items-center gap-4">
                  <Label htmlFor={`notif-${c.id}`} className="flex-1 cursor-pointer">
                    <span className="text-sm font-medium">{c.title}</span>
                    <div className="text-xs text-muted-foreground font-normal">
                      {c.subtitle}
                    </div>
                  </Label>
                  <Checkbox
                    id={`notif-${c.id}`}
                    checked={prefs[c.id]}
                    disabled={!hydrated}
                    onCheckedChange={(v) => toggle(c.id, v === true)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
