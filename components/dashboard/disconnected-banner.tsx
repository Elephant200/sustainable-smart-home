"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeviceHealth {
  device_id: string;
  name: string;
  provider_type: string;
  status: "live" | "stale" | "disconnected" | "never_synced";
  last_error_at: string | null;
  last_success_at: string | null;
}

/**
 * How long (in hours) a device must be in a non-live state before we surface
 * the banner. This prevents false-positives from transient 1–2 failure streaks
 * that the sync cron may recover from on the next run.
 * Override via NEXT_PUBLIC_DISCONNECTED_BANNER_THRESHOLD_HOURS env var.
 */
const DISCONNECTED_THRESHOLD_HOURS = parseFloat(
  process.env.NEXT_PUBLIC_DISCONNECTED_BANNER_THRESHOLD_HOURS ?? "1"
);
const DISCONNECTED_THRESHOLD_MS = DISCONNECTED_THRESHOLD_HOURS * 3600 * 1000;

function isLongDisconnected(device: DeviceHealth): boolean {
  if (device.status === "live" || device.status === "never_synced") return false;

  // For "disconnected": check whether last_error_at (or last_success_at, whichever
  // represents when the device stopped being live) is older than the threshold.
  const referenceTs =
    device.status === "disconnected"
      ? device.last_error_at
      : device.last_success_at; // "stale" — last success is when it went quiet

  if (!referenceTs) {
    // No timestamp → can't determine duration; show the banner conservatively.
    return true;
  }

  return Date.now() - new Date(referenceTs).getTime() >= DISCONNECTED_THRESHOLD_MS;
}

export function DisconnectedBanner() {
  const [problematic, setProblematic] = useState<DeviceHealth[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/configuration/devices/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { devices?: DeviceHealth[] } | null) => {
        if (!json?.devices) return;
        setProblematic(json.devices.filter(isLongDisconnected));
      })
      .catch(() => {});
  }, []);

  if (dismissed || problematic.length === 0) return null;

  const names = problematic.slice(0, 3).map((d) => d.name);
  const extra = problematic.length - names.length;
  const label = extra > 0 ? `${names.join(", ")} and ${extra} more` : names.join(", ");
  const verb = problematic.length === 1 ? "is" : "are";
  const hasStale = problematic.some((d) => d.status === "stale");
  const hasDisconnected = problematic.some((d) => d.status === "disconnected");
  const stateLabel =
    hasDisconnected && hasStale
      ? "disconnected or stale"
      : hasDisconnected
      ? "disconnected"
      : "stale";

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-warning">Device connection issue</span>
        <span className="text-muted-foreground ml-1">
          {label} {verb} {stateLabel} —
          the dashboard may be showing outdated data.
        </span>
        <Link
          href="/app/settings#device-health"
          className="ml-2 underline underline-offset-2 text-foreground hover:text-primary transition-colors"
        >
          Fix in Settings →
        </Link>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 -mt-0.5 -mr-1 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
