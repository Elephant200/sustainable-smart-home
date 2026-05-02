import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import {
  computeBatteryStateAt,
  computeBatteryHistory,
  timeToFullHours,
  computeHouseLoadInstant,
  RESERVE_FRACTION,
  ROUND_TRIP_EFFICIENCY_PCT,
  BATTERY_COOLING_TEMP_THRESHOLD_F,
  healthLabel,
  backupModeLabel,
} from '@/lib/simulation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  if (context.batteryConfigs.length === 0) {
    return NextResponse.json({
      battery: null,
      modules: [],
      history: [],
    });
  }

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const battery = context.batteryConfigs[0];
  const state = computeBatteryStateAt(
    battery,
    now,
    context.solarConfigs,
    context.evConfigs
  );

  const history = computeBatteryHistory(
    battery,
    startToday,
    now,
    context.solarConfigs,
    context.evConfigs
  );

  const moduleCount = 4;
  const perModuleCapacity = battery.capacity_kwh / moduleCount;
  const modules = Array.from({ length: moduleCount }, (_, i) => {
    const variation = 0.96 + ((i * 7919) % 100) / 2500;
    const charge = Math.max(0, Math.min(100, state.soc_percent * variation));
    return {
      id: i + 1,
      charge_pct: Math.round(charge),
      capacity_kwh: Math.round(perModuleCapacity * 10) / 10,
      health_pct: 96 + (i % 4),
      temperature_f: 70 + ((i * 13) % 6),
      power_kw: Math.round((state.power_kw / moduleCount) * 100) / 100,
      status:
        state.power_kw > 0.05
          ? 'charging'
          : state.power_kw < -0.05
            ? 'discharging'
            : 'idle',
    };
  });

  const dischargedToday = history
    .filter((h) => h.power_kw < 0)
    .reduce((s, h) => s + -h.power_kw, 0);
  const chargedToday = history
    .filter((h) => h.power_kw > 0)
    .reduce((s, h) => s + h.power_kw, 0);

  const avgHealth = modules.reduce((s, m) => s + m.health_pct, 0) / moduleCount;
  const avgTempF = modules.reduce((s, m) => s + m.temperature_f, 0) / moduleCount;

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

  const reserveKwh = RESERVE_FRACTION * battery.capacity_kwh;
  const availableBackupKwh = Math.max(0, state.soc_kwh - reserveKwh);

  return NextResponse.json({
    battery: {
      id: battery.id,
      name: findDeviceName(context.rawDevices, battery.id),
      capacity_kwh: battery.capacity_kwh,
      max_flow_kw: battery.max_flow_kw,
      soc_percent: Math.round(state.soc_percent * 10) / 10,
      soc_kwh: Math.round(state.soc_kwh * 10) / 10,
      power_kw: Math.round(state.power_kw * 100) / 100,
      hours_to_full: Math.round(timeToFullHours(battery, state) * 10) / 10,
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
      grid_services_enabled: battery.max_flow_kw >= 5,
      backup_mode_label: backupModeLabel(availableBackupKwh, criticalLoadKw),
      grid_connection_label: 'Online',
    },
    modules,
    history: history.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      soc_percent: Math.round(h.soc_percent * 10) / 10,
      power_kw: Math.round(h.power_kw * 100) / 100,
    })),
  });
}
