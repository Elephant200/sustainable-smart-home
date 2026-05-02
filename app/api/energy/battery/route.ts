import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters';
import {
  timeToFullHours,
  computeHouseLoadInstant,
  RESERVE_FRACTION,
  ROUND_TRIP_EFFICIENCY_PCT,
  BATTERY_COOLING_TEMP_THRESHOLD_F,
  healthLabel,
  backupModeLabel,
} from '@/lib/simulation';
import type { BatteryModule } from '@/lib/adapters/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');

  if (batteryDevices.length === 0) {
    return NextResponse.json({
      battery: null,
      modules: [],
      history: [],
    });
  }

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  // Fan out to each battery via its adapter. The simulated adapter receives
  // cross-device context so it can model surplus/load; real provider adapters
  // ignore the context because their upstream API already has full site
  // context. Either way, the route consumes only DeviceStatus and
  // HistoricalPoint values from the adapter contract — never simulation
  // internals — so swapping a battery's provider_type to 'tesla' or
  // 'enphase' requires no changes here.
  //
  // NOTE: With 2+ simulated batteries the per-device adapter calls each see
  // the full site surplus independently and may both claim it, inflating
  // aggregate power. Real-hardware providers don't have this problem (they
  // report each battery's actual measured power). Fleet-level dispatch for
  // the simulated case is tracked as a follow-up; today's seed data has a
  // single battery per user so this isn't user-visible.
  const perDevice = await Promise.all(
    batteryDevices.map(async (device) => {
      const adapter = createAdapter(device, {
        solar: context.solarConfigs,
        ev: context.evConfigs,
        battery: context.batteryConfigs.find((b) => b.id === device.id) ?? null,
      });
      const [status, socSeries, powerSeries] = await Promise.all([
        adapter.getStatus(),
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

  // Aggregate headline metrics from the adapter contract. If a provider
  // adapter omits the optional capacity/max_flow fields, fall back to the
  // device's stored config so the headline KPIs (SoC%, reserve, hours-to-
  // full) never collapse to zero.
  const lookupCfg = (deviceId: string) =>
    context.batteryConfigs.find((b) => b.id === deviceId);
  const totalCapacityKwh = perDevice.reduce(
    (s, p) =>
      s + (p.status.batteryCapacityKwh ?? lookupCfg(p.device.id)?.capacity_kwh ?? 0),
    0
  );
  const totalMaxFlowKw = perDevice.reduce(
    (s, p) =>
      s + (p.status.batteryMaxFlowKw ?? lookupCfg(p.device.id)?.max_flow_kw ?? 0),
    0
  );
  const totalSocKwh = perDevice.reduce(
    (s, p) => s + (p.status.batterySOCKwh ?? 0),
    0
  );
  const totalPowerKw = perDevice.reduce(
    (s, p) => s + (p.status.batteryPowerKw ?? 0),
    0
  );
  const aggregateSocPercent =
    totalCapacityKwh > 0 ? (totalSocKwh / totalCapacityKwh) * 100 : 0;

  // Concatenate modules from every battery, renumbering ids so the UI shows
  // a single contiguous list (1, 2, 3, ...).
  const modules: BatteryModule[] = perDevice
    .flatMap((p) => p.status.batteryModules ?? [])
    .map((m, i) => ({ ...m, id: i + 1 }));

  // Combined SoC history: bucket every series into hourly UTC buckets keyed
  // by the timestamp's unix-hour, then sum per bucket. This works even when
  // adapters return different cadences, missing points, or out-of-order
  // samples — index alignment would silently mis-sum across providers.
  const HOUR_MS = 3600_000;
  const bucketHour = (d: Date) => Math.floor(d.getTime() / HOUR_MS);
  const socBuckets = new Map<number, number>();
  const powerBuckets = new Map<number, number>();
  for (const p of perDevice) {
    for (const pt of p.socSeries) {
      const k = bucketHour(pt.timestamp);
      socBuckets.set(k, (socBuckets.get(k) ?? 0) + pt.value);
    }
    for (const pt of p.powerSeries) {
      const k = bucketHour(pt.timestamp);
      powerBuckets.set(k, (powerBuckets.get(k) ?? 0) + pt.value);
    }
  }
  const allBucketKeys = Array.from(
    new Set([...socBuckets.keys(), ...powerBuckets.keys()])
  ).sort((a, b) => a - b);
  const combinedHistory = allBucketKeys.map((k) => {
    const sumSocKwh = socBuckets.get(k) ?? 0;
    const sumPowerKw = powerBuckets.get(k) ?? 0;
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

  // Prefer per-module health when available; otherwise fall back to whatever
  // aggregate batteryHealthPct the adapters reported, then 100. This lets
  // real providers that don't expose module-level data still drive the
  // headline.
  const avgHealth =
    modules.length > 0
      ? modules.reduce((s, m) => s + m.health_pct, 0) / modules.length
      : (() => {
          const reported = perDevice
            .map((p) => p.status.batteryHealthPct)
            .filter((v): v is number => typeof v === 'number');
          return reported.length > 0
            ? reported.reduce((s, v) => s + v, 0) / reported.length
            : 100;
        })();
  const avgTempF =
    modules.length > 0
      ? modules.reduce((s, m) => s + m.temperature_f, 0) / modules.length
      : 70;

  // Critical-load estimate: average house load during the overnight backup
  // window (00:00–06:00). This is what the battery would have to support if
  // the grid went down at night.
  const overnightHouse: number[] = [];
  for (let h = 0; h < 6; h++) {
    const t = new Date(startToday);
    t.setHours(h);
    overnightHouse.push(computeHouseLoadInstant(t));
  }
  const criticalLoadKw =
    overnightHouse.length > 0
      ? Math.round(
          (overnightHouse.reduce((s, v) => s + v, 0) / overnightHouse.length) *
            10
        ) / 10
      : 1.0;

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
      capacity_kwh: totalCapacityKwh,
      max_flow_kw: totalMaxFlowKw,
      soc_percent: Math.round(aggregateSocPercent * 10) / 10,
      soc_kwh: Math.round(totalSocKwh * 10) / 10,
      power_kw: Math.round(totalPowerKw * 100) / 100,
      hours_to_full:
        Math.round(timeToFullHours(aggregateConfig, aggregateState) * 10) / 10,
      health_pct: Math.round(avgHealth),
      health_label: healthLabel(avgHealth),
      charged_today_kwh: Math.round(chargedToday * 10) / 10,
      discharged_today_kwh: Math.round(dischargedToday * 10) / 10,
      round_trip_efficiency_pct: ROUND_TRIP_EFFICIENCY_PCT,
      reserve_floor_pct: Math.round(RESERVE_FRACTION * 100),
      reserve_kwh: Math.round(reserveKwh * 10) / 10,
      available_backup_kwh: Math.round(availableBackupKwh * 10) / 10,
      critical_load_kw: criticalLoadKw,
      cooling_active: avgTempF >= BATTERY_COOLING_TEMP_THRESHOLD_F,
      tou_enabled: true,
      peak_shaving_enabled: true,
      grid_services_enabled: totalMaxFlowKw >= 5,
      backup_mode_label: backupModeLabel(availableBackupKwh, criticalLoadKw),
      grid_connection_label: 'Online',
    },
    modules,
    history: combinedHistory.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      soc_percent: Math.round(h.soc_percent * 10) / 10,
      power_kw: Math.round(h.power_kw * 100) / 100,
    })),
  });
}
