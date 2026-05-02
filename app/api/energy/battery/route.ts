import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import {
  computeBatteryStateAt,
  computeBatteryHistory,
  timeToFullHours,
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
      health_pct: 98,
      charged_today_kwh: Math.round(chargedToday * 10) / 10,
      discharged_today_kwh: Math.round(dischargedToday * 10) / 10,
    },
    modules,
    history: history.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      soc_percent: Math.round(h.soc_percent * 10) / 10,
      power_kw: Math.round(h.power_kw * 100) / 100,
    })),
  });
}
