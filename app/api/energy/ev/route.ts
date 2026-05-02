import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import {
  computeEvSocPercent,
  computeEvChargeRateKw,
  computeHouseLoadInstant,
  computeSolarArrayInstant,
  estimateRangeMiles,
  timeToFull,
  isOvernightWindow,
  solveFlowsHistory,
  offPeakWindowLabel,
  offPeakStartLabel,
  fmtClock12h,
  PRIORITY_MODE_LABEL,
  EV_EFFICIENCY_MI_PER_KWH,
} from '@/lib/simulation';

export const dynamic = 'force-dynamic';

function fmtTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const am = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${am}`;
}

export async function GET() {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const battery = context.batteryConfigs[0] ?? null;
  const todayFlows = solveFlowsHistory(
    startToday,
    now,
    context.solarConfigs,
    context.evConfigs,
    battery
  );
  const totalEvKwhToday = todayFlows.reduce((s, f) => s + f.ev_kw, 0);

  const cleanEnergyKwh = todayFlows.reduce((s, f) => {
    const cleanShare = f.solar_kw > 0 ? Math.min(1, f.solar_kw / Math.max(0.001, f.solar_kw + Math.max(0, f.grid_kw))) : 0;
    return s + f.ev_kw * cleanShare;
  }, 0);
  const cleanEnergyPct =
    totalEvKwhToday > 0 ? Math.round((cleanEnergyKwh / totalEvKwhToday) * 100) : 0;

  const solarNow = context.solarConfigs.reduce(
    (s, c) => s + computeSolarArrayInstant(c, now).total_output_kw,
    0
  );
  let vehicleSurplus = Math.max(0, solarNow - computeHouseLoadInstant(now));

  // Find when each vehicle most recently drew power. We walk back from `now`
  // (up to 7 days) sampling the EV charge rate at hour boundaries — this is
  // deterministic from the simulation model, no fake timestamp.
  function findLastChargedAt(cfg: typeof context.evConfigs[number]): Date | null {
    const cursor = new Date(now);
    cursor.setMinutes(0, 0, 0);
    for (let i = 0; i < 24 * 7; i++) {
      const t = new Date(cursor.getTime() - i * 60 * 60 * 1000);
      const surplus = Math.max(
        0,
        context.solarConfigs.reduce(
          (s, c) => s + computeSolarArrayInstant(c, t).total_output_kw,
          0
        ) - computeHouseLoadInstant(t)
      );
      if (computeEvChargeRateKw(cfg, t, surplus) > 0.1) return t;
    }
    return null;
  }

  const vehicles = context.evConfigs.map((cfg) => {
    const soc = computeEvSocPercent(cfg, now);
    const rate = computeEvChargeRateKw(cfg, now, vehicleSurplus);
    vehicleSurplus = Math.max(0, vehicleSurplus - rate);
    const tt = timeToFull(soc, cfg);
    const status: 'charging' | 'completed' | 'disconnected' =
      rate > 0.1 ? 'charging' : soc >= cfg.target_charge * 100 - 0.5 ? 'completed' : 'disconnected';
    const lastChargedSoc = computeEvSocPercent(cfg, new Date(now.getTime() - 60 * 60 * 1000));

    let lastChargedLabel: string;
    if (rate > 0.1) {
      lastChargedLabel = 'Now';
    } else {
      const at = findLastChargedAt(cfg);
      if (!at) {
        lastChargedLabel = '—';
      } else {
        const ageMs = now.getTime() - at.getTime();
        const ageHr = ageMs / 3600000;
        if (ageHr < 1) lastChargedLabel = `${Math.max(1, Math.round(ageMs / 60000))} min ago`;
        else if (at.toDateString() === now.toDateString()) lastChargedLabel = `Today ${fmtTime(at)}`;
        else if (ageHr < 48) lastChargedLabel = `Yesterday ${fmtTime(at)}`;
        else lastChargedLabel = `${Math.floor(ageHr / 24)} days ago`;
      }
    }

    const departureShort = fmtClock12h(String(cfg.departure_time).slice(0, 5));
    return {
      id: cfg.id,
      name: findDeviceName(context.rawDevices, cfg.id),
      battery_capacity_kwh: cfg.battery_capacity_kwh,
      target_charge_pct: cfg.target_charge * 100,
      battery_level_pct: Math.round(soc),
      range_mi: estimateRangeMiles(soc, cfg.battery_capacity_kwh),
      max_range_mi: estimateRangeMiles(100, cfg.battery_capacity_kwh),
      charging_status: status,
      plugged_in: rate > 0 || isOvernightWindow(now),
      charge_rate_kw: Math.round(rate * 100) / 100,
      time_to_full_label: tt.label,
      last_charged_label: lastChargedLabel,
      // Efficiency is the simulator's documented model constant, not a
      // hardcoded UI string. Real adapters that compute actual mi/kWh from
      // telemetry will report their own value here.
      efficiency_mi_per_kwh: EV_EFFICIENCY_MI_PER_KWH,
      departure_time: cfg.departure_time,
      schedule_window_label: `${offPeakStartLabel()} – ${departureShort}`,
      _diff: Math.round(soc - lastChargedSoc),
    };
  });

  const history24h: { time: string; total_kw: number; per_vehicle: Record<string, number> }[] = [];
  const cursor = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  cursor.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const t = new Date(cursor.getTime() + i * 60 * 60 * 1000);
    const perVehicle: Record<string, number> = {};
    let totalKw = 0;
    const solar = context.solarConfigs.reduce(
      (s, c) => s + computeSolarArrayInstant(c, t).total_output_kw,
      0
    );
    let surplus = Math.max(0, solar - computeHouseLoadInstant(t));
    for (const cfg of context.evConfigs) {
      const rate = computeEvChargeRateKw(cfg, t, surplus);
      surplus = Math.max(0, surplus - rate);
      const name = findDeviceName(context.rawDevices, cfg.id);
      perVehicle[name] = Math.round(rate * 100) / 100;
      totalKw += rate;
    }
    history24h.push({
      time: fmtTime(t),
      total_kw: Math.round(totalKw * 100) / 100,
      per_vehicle: perVehicle,
    });
  }

  const totalCurrentKw = vehicles.reduce((s, v) => s + v.charge_rate_kw, 0);
  const chargingCount = vehicles.filter((v) => v.charging_status === 'charging').length;

  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthFlows = solveFlowsHistory(
    month,
    now,
    context.solarConfigs,
    context.evConfigs,
    battery
  );
  const monthEvKwh = monthFlows.reduce((s, f) => s + f.ev_kw, 0);
  const monthEvCostSavings = monthEvKwh * 0.18 * 0.18;

  return NextResponse.json({
    vehicles,
    history: history24h,
    summary: {
      current_total_kw: Math.round(totalCurrentKw * 100) / 100,
      charging_count: chargingCount,
      energy_today_kwh: Math.round(totalEvKwhToday * 10) / 10,
      cost_savings_usd: Math.round(monthEvCostSavings * 100) / 100,
      clean_energy_pct: cleanEnergyPct,
      month_energy_mwh: Math.round((monthEvKwh / 1000) * 100) / 100,
      off_peak_window_label: offPeakWindowLabel(),
      off_peak_start_label: offPeakStartLabel(),
      priority_mode_label: PRIORITY_MODE_LABEL,
    },
  });
}
