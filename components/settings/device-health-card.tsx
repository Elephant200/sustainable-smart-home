"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, WifiOff } from "lucide-react";

interface DeviceHealth {
  device_id: string;
  name: string;
  type: string;
  provider_type: string;
  status: "live" | "stale" | "disconnected" | "never_synced";
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  consecutive_failures: number;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  tesla: "Tesla",
  enphase: "Enphase",
  solaredge: "SolarEdge",
  emporia: "Emporia Vue",
  home_assistant: "Home Assistant",
};

const OAUTH_PROVIDERS = new Set(["tesla", "enphase"]);

function StatusPill({ status }: { status: DeviceHealth["status"] }) {
  switch (status) {
    case "live":
      return (
        <Badge className="gap-1 bg-success/15 text-success border-success/30">
          <CheckCircle2 className="h-3 w-3" />
          Live
        </Badge>
      );
    case "stale":
      return (
        <Badge className="gap-1 bg-warning/15 text-warning border-warning/30">
          <Clock className="h-3 w-3" />
          Stale
        </Badge>
      );
    case "disconnected":
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" />
          Disconnected
        </Badge>
      );
    case "never_synced":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Not synced
        </Badge>
      );
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function DeviceHealthRow({ device }: { device: DeviceHealth }) {
  const providerLabel = PROVIDER_DISPLAY[device.provider_type] ?? device.provider_type;
  const isOAuth = OAUTH_PROVIDERS.has(device.provider_type);

  const handleReconnect = () => {
    if (isOAuth) {
      window.location.href = `/api/auth/oauth/${device.provider_type}/start?device_id=${device.device_id}`;
    } else {
      const el = document.getElementById("device-configuration");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{device.name}</span>
            <span className="text-xs text-muted-foreground">{providerLabel}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <StatusPill status={device.status} />
            <span className="text-xs text-muted-foreground">
              Last sync: {formatRelative(device.last_sync_at)}
            </span>
            {device.last_success_at && device.status !== "live" && (
              <span className="text-xs text-muted-foreground">
                Last success: {formatRelative(device.last_success_at)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleReconnect}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reconnect
        </Button>
      </div>
      {device.last_error_message && device.status !== "live" && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-all">{device.last_error_message}</span>
        </div>
      )}
    </div>
  );
}

export function DeviceHealthCard() {
  const [devices, setDevices] = useState<DeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/configuration/devices/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDevices(json.devices ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No real-hardware devices configured. Add a device with a live provider (Tesla, Enphase, etc.) to see connection health here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {devices.length} device{devices.length !== 1 ? "s" : ""} monitored
        </p>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
      {devices.map((device) => (
        <DeviceHealthRow key={device.device_id} device={device} />
      ))}
    </div>
  );
}
