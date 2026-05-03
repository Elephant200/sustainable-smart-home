import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters';
import { createClient } from '@/lib/supabase/server';
import { pickHouseDevice } from '@/lib/server/system-devices';
import { getPollingConfig } from '@/lib/server/polling-config';
import {
  timeToFullHours,
  RESERVE_FRACTION,
  ROUND_TRIP_EFFICIENCY_PCT,
  healthLabel,
  backupModeLabel,
} from '@/lib/simulation';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';
import type { ProviderType } from '@/lib/adapters/types';

const log = createLogger({ route: '/api/energy/battery' });

const NoQuerySchema = z.object({}).strict();

export const dynamic = 'force-dynamic';

const HOUR_MS = 3600_000;
const bucketHour = (d: Date) => Math.floor(d.getTime() / HOUR_MS);

/**
 * Normalize a device's history to at most one value per UTC hour by keeping
 * the latest sample inside each hour bucket. This makes aggregation across
 * devices safe even when adapters return different cadences (or extra
 * samples) — without this, summing across device samples would inflate SoC
 * and power by sample count.
 */
function bucketLastByHour(
  series: { timestamp: Date; value: number }[]
): Map<number, number> {
  const latestTsByBucket = new Map<number, number>();
  const valueByBucket = new Map<number, number>();
  for (const pt of series) {
    const k = bucketHour(pt.timestamp);
    const ts = pt.timestamp.getTime();
    const prev = latestTsByBucket.get(k);
    if (prev === undefined || ts >= prev) {
      latestTsByBucket.set(k, ts);
      valueByBucket.set(k, pt.value);
    }
  }
  return valueByBucket;
}

export async function GET(req: NextRequest) {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const rateLimitError = checkReadRateLimit(req, context.user.id);
  if (rateLimitError) return rateLimitError;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  const reqLog = log.child({
    request_id: req.headers.get('x-request-id') ?? undefined,
    user_id: context.user.id,
  });
  reqLog.info('battery request');

  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');

  if (batteryDevices.length === 0) {
    return NextResponse.json({
      battery: null,
      devices: [],
      history: [],
    });
  }

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  // Load sync-state rows for all battery devices in one query so we can
  // prefer persisted battery_state rows when the background cron has a
  // recent successful sync — reducing live provider API calls and latency.
  const liveBatteryIds = batteryDevices
    .filter((d) => d.provider_type !== 'simulated')
    .map((d) => d.id);

  const syncStateByDevice = new Map<string, { lastSuccessAt: Date | null; isFresh: boolean }>();
  if (liveBatteryIds.length > 0) {
    const supabase = await createClient();
    const { data: syncRows } = await supabase
      .from('device_sync_state')
      .select('device_id, last_success_at')
      .in('device_id', liveBatteryIds);
    for (const row of syncRows ?? []) {
      const lastSuccessAt = row.last_success_at ? new Date(row.last_success_at) : null;
      const providerType = batteryDevices.find((d) => d.id === row.device_id)?.provider_type as ProviderType | undefined;
      const cfg = providerType ? getPollingConfig(providerType) : null;
      const isFresh =
        lastSuccessAt != null &&
        cfg != null &&
        (Date.now() - lastSuccessAt.getTime()) / 1000 <= cfg.minIntervalSec * 2;
      syncStateByDevice.set(row.device_id, { lastSuccessAt, isFresh });
    }
  }

  // Fan out to each battery via its adapter, or read from persisted
  // battery_state rows when a fresh background sync is available.
  const perDevice = await Promise.all(
    batteryDevices.map(async (device) => {
      const adapterOpts = {
        solar: context.solarConfigs,
        ev: context.evConfigs,
        battery: context.batteryConfigs.find((b) => b.id === device.id) ?? null,
        persistConfig: context.persistConnectionConfig,
      };
      const adapter = createAdapter(device, adapterOpts);

      // For live devices with a fresh persisted sync, read battery_state for
      // current status rather than calling the provider API again.
      // Two-layer freshness check:
      //   1. device_sync_state.last_success_at is within 2× the polling window
      //      (guards against sync_state being ahead of the actual persisted row,
      //       e.g. when the ingestion write fails after updateSyncState succeeds).
      //   2. The battery_state row's own timestamp is within the same window
      //      (ensures we actually have a row from the recent sync, not a stale one).
      const syncInfo = syncStateByDevice.get(device.id);
      let status: Awaited<ReturnType<typeof adapter.getStatus>>;
      if (syncInfo?.isFresh && device.provider_type !== 'simulated') {
        const supabase = await createClient();
        const { data: persistedState } = await supabase
          .from('battery_state')
          .select('soc_percent, soc_kwh, timestamp')
          .eq('device_id', device.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        const cfg = context.batteryConfigs.find((b) => b.id === device.id);
        const providerCfg = getPollingConfig(device.provider_type as ProviderType);
        const rowFresh =
          persistedState != null &&
          (Date.now() - new Date(persistedState.timestamp).getTime()) / 1000 <=
            providerCfg.minIntervalSec * 2;
        if (rowFresh && persistedState) {
          // batteryPowerKw is intentionally undefined — battery_state only stores
          // SoC snapshots, not instantaneous power. The route's consumer already
          // defaults powerKw to 0 when undefined (see `powerKw` below).
          status = {
            deviceId: device.id,
            providerType: device.provider_type as ProviderType,
            timestamp: new Date(persistedState.timestamp),
            isLive: true,
            batterySOCPercent: persistedState.soc_percent ?? 0,
            batterySOCKwh: persistedState.soc_kwh ?? 0,
            batteryPowerKw: undefined,
            batteryCapacityKwh: cfg?.capacity_kwh,
            batteryMaxFlowKw: cfg?.max_flow_kw,
          };
        } else {
          status = await adapter.getStatus();
        }
      } else {
        status = await adapter.getStatus();
      }

      // History always comes from the adapter (provider history is richer than
      // our persisted battery_state snapshot rows which only track current SoC).
      const [socSeries, powerSeries] = await Promise.all([
        adapter.getHistory({
          metric: 'soc_kwh',
          startDate: startToday,
          endDate: now,
        }),
        adapter.getHistory({
          metric: 'power_kw',
          startDate: startToday,
          endDate: now,
        }),
      ]);
      return { device, status, socSeries, powerSeries };
    })
  );

  // Per-device cards: one entry per actual battery in the user's account.
  // No synthetic per-module breakdown — that would be fabricating data the
  // provider doesn't expose. Health is only included when the adapter reports
  // it; otherwise it stays null so the UI can omit the row instead of
  // showing a fake 100%.
  const lookupCfg = (deviceId: string) =>
    context.batteryConfigs.find((b) => b.id === deviceId);
  const devices = perDevice.map((p) => {
    const cfg = lookupCfg(p.device.id);
    const capacityKwh =
      p.status.batteryCapacityKwh ?? cfg?.capacity_kwh ?? 0;
    const maxFlowKw = p.status.batteryMaxFlowKw ?? cfg?.max_flow_kw ?? 0;
    const socKwh = p.status.batterySOCKwh ?? 0;
    const powerKw = p.status.batteryPowerKw ?? 0;
    const socPct =
      capacityKwh > 0 ? (socKwh / capacityKwh) * 100 : 0;
    const status: 'charging' | 'discharging' | 'idle' =
      powerKw > 0.05 ? 'charging' : powerKw < -0.05 ? 'discharging' : 'idle';
    return {
      id: p.device.id,
      name: findDeviceName(context.rawDevices, p.device.id),
      capacity_kwh: Math.round(capacityKwh * 10) / 10,
      max_flow_kw: maxFlowKw,
      soc_percent: Math.round(socPct * 10) / 10,
      soc_kwh: Math.round(socKwh * 10) / 10,
      power_kw: Math.round(powerKw * 100) / 100,
      status,
      health_pct:
        typeof p.status.batteryHealthPct === 'number'
          ? Math.round(p.status.batteryHealthPct)
          : null,
    };
  });

  // Aggregate headline metrics from per-device data.
  const totalCapacityKwh = devices.reduce((s, d) => s + d.capacity_kwh, 0);
  const totalMaxFlowKw = devices.reduce((s, d) => s + d.max_flow_kw, 0);
  const totalSocKwh = devices.reduce((s, d) => s + d.soc_kwh, 0);
  const totalPowerKw = devices.reduce((s, d) => s + d.power_kw, 0);
  const aggregateSocPercent =
    totalCapacityKwh > 0 ? (totalSocKwh / totalCapacityKwh) * 100 : 0;
  const reportedHealth = devices
    .map((d) => d.health_pct)
    .filter((v): v is number => typeof v === 'number');
  const avgHealth =
    reportedHealth.length > 0
      ? reportedHealth.reduce((s, v) => s + v, 0) / reportedHealth.length
      : null;

  // Combined SoC history: normalize each device's series to ONE value per
  // UTC hour first (latest sample wins), then sum across devices per hour.
  // This keeps stack-level SoC/power correct regardless of per-adapter
  // cadence — index alignment or naive summation would silently inflate.
  const perDeviceSocBuckets = perDevice.map((p) => bucketLastByHour(p.socSeries));
  const perDevicePowerBuckets = perDevice.map((p) => bucketLastByHour(p.powerSeries));
  const allBucketKeys = Array.from(
    new Set([
      ...perDeviceSocBuckets.flatMap((m) => Array.from(m.keys())),
      ...perDevicePowerBuckets.flatMap((m) => Array.from(m.keys())),
    ])
  ).sort((a, b) => a - b);
  const combinedHistory = allBucketKeys.map((k) => {
    const sumSocKwh = perDeviceSocBuckets.reduce(
      (s, m) => s + (m.get(k) ?? 0),
      0
    );
    const sumPowerKw = perDevicePowerBuckets.reduce(
      (s, m) => s + (m.get(k) ?? 0),
      0
    );
    const socPct =
      totalCapacityKwh > 0 ? (sumSocKwh / totalCapacityKwh) * 100 : 0;
    return {
      timestamp: new Date(k * HOUR_MS),
      soc_percent: socPct,
      power_kw: sumPowerKw,
    };
  });

  const dischargedToday = combinedHistory
    .filter((h) => h.power_kw < 0)
    .reduce((s, h) => s + -h.power_kw, 0);
  const chargedToday = combinedHistory
    .filter((h) => h.power_kw > 0)
    .reduce((s, h) => s + h.power_kw, 0);

  // Critical-load estimate: average house load during the overnight backup
  // window (00:00–06:00). This is what the battery would have to support if
  // the grid went down at night. We derive it from the user's configured
  // house device's actual hourly history — never the simulator. With no
  // house device configured we leave it `null` and let the UI surface a
  // "configure a house meter to see backup runtime" hint.
  const houseDevice = pickHouseDevice(context.rawDevices);
  let criticalLoadKw: number | null = null;
  if (houseDevice) {
    const overnightEnd = new Date(startToday);
    overnightEnd.setHours(6);
    const houseSeries = await createAdapter(houseDevice, {
      persistConfig: context.persistConnectionConfig,
    }).getHistory({
      metric: 'energy_kwh',
      startDate: startToday,
      endDate: overnightEnd,
    });
    if (houseSeries.length > 0) {
      // Each sample carries kWh-in-the-interval; treat as average kW over
      // the overnight window: total kWh / 6 hours.
      const totalKwh = houseSeries.reduce((s, p) => s + p.value, 0);
      criticalLoadKw = Math.round((totalKwh / 6) * 10) / 10;
    }
  }

  const reserveKwh = RESERVE_FRACTION * totalCapacityKwh;
  const availableBackupKwh = Math.max(0, totalSocKwh - reserveKwh);

  const primaryDevice = perDevice[0];
  const displayName =
    perDevice.length > 1
      ? `${perDevice.length} batteries`
      : findDeviceName(context.rawDevices, primaryDevice.device.id);

  // For headline "hours to full" treat the whole stack as one virtual battery.
  const aggregateConfig = {
    id: 'aggregate',
    capacity_kwh: totalCapacityKwh,
    max_flow_kw: totalMaxFlowKw,
  };
  const aggregateState = {
    soc_percent: aggregateSocPercent,
    soc_kwh: totalSocKwh,
    power_kw: totalPowerKw,
  };

  return NextResponse.json({
    battery: {
      id: primaryDevice.device.id,
      name: displayName,
      device_count: perDevice.length,
      capacity_kwh: Math.round(totalCapacityKwh * 10) / 10,
      max_flow_kw: totalMaxFlowKw,
      soc_percent: Math.round(aggregateSocPercent * 10) / 10,
      soc_kwh: Math.round(totalSocKwh * 10) / 10,
      power_kw: Math.round(totalPowerKw * 100) / 100,
      hours_to_full:
        Math.round(timeToFullHours(aggregateConfig, aggregateState) * 10) / 10,
      // Health is null when no provider exposes it — the UI hides the metric
      // rather than showing a synthetic 100%.
      health_pct: avgHealth != null ? Math.round(avgHealth) : null,
      health_label: avgHealth != null ? healthLabel(avgHealth) : null,
      charged_today_kwh: Math.round(chargedToday * 10) / 10,
      discharged_today_kwh: Math.round(dischargedToday * 10) / 10,
      round_trip_efficiency_pct: ROUND_TRIP_EFFICIENCY_PCT,
      reserve_floor_pct: Math.round(RESERVE_FRACTION * 100),
      reserve_kwh: Math.round(reserveKwh * 10) / 10,
      available_backup_kwh: Math.round(availableBackupKwh * 10) / 10,
      critical_load_kw: criticalLoadKw,
      backup_mode_label:
        criticalLoadKw != null
          ? backupModeLabel(availableBackupKwh, criticalLoadKw)
          : null,
    },
    devices,
    history: combinedHistory.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      soc_percent: Math.round(h.soc_percent * 10) / 10,
      power_kw: Math.round(h.power_kw * 100) / 100,
    })),
  });
}
