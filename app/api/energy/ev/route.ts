import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { makeGridDevice } from '@/lib/server/system-devices';
import {
  estimateRangeMiles,
  timeToFull,
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const adapterCtx = {
    solar: context.solarConfigs,
    ev: context.evConfigs,
    battery: context.batteryConfigs[0] ?? null,
  };

  const evDevices = context.rawDevices.filter((d) => d.type === 'ev');

  // Per-vehicle current status + per-vehicle 7-day charge history (used to
  // derive last_charged_label deterministically) all flow through the
  // adapter contract.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start24h = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  start24h.setMinutes(0, 0, 0);

  const [evStatuses, evWeekHistories, ev24hHistories, evMonthHistories, gridDayHistory, gridMonthHistory] =
    await Promise.all([
      Promise.all(evDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      Promise.all(
        evDevices.map((d) =>
          createAdapter(d, adapterCtx).getHistory({
            metric: 'charge_kw',
            startDate: sevenDaysAgo,
            endDate: now,
          })
        )
      ),
      Promise.all(
        evDevices.map((d) =>
          createAdapter(d, adapterCtx).getHistory({
            metric: 'charge_kw',
            startDate: start24h,
            endDate: now,
          })
        )
      ),
      Promise.all(
        evDevices.map((d) =>
          createAdapter(d, adapterCtx).getHistory({
            metric: 'charge_kw',
            startDate: monthStart,
            endDate: now,
          })
        )
      ),
      // Grid kW history — used to compute "clean energy %" alongside solar
      createAdapter(makeGridDevice(context.user.id), adapterCtx).getHistory({
        metric: 'grid_kw',
        startDate: startToday,
        endDate: now,
      }),
      createAdapter(makeGridDevice(context.user.id), adapterCtx).getHistory({
        metric: 'grid_kw',
        startDate: monthStart,
        endDate: now,
      }),
    ]);

  // Solar history (for clean-energy %) — sum across solar adapters
  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');
  const solarTodayHistories = await Promise.all(
    solarDevices.map((d) =>
      createAdapter(d, adapterCtx).getHistory({
        metric: 'energy_kwh',
        startDate: startToday,
        endDate: now,
      })
    )
  );
  const solarHourly = new Map<string, number>();
  for (const series of solarTodayHistories) {
    for (const pt of series) {
      const key = pt.timestamp.toISOString();
      solarHourly.set(key, (solarHourly.get(key) ?? 0) + pt.value);
    }
  }

  // Today's total EV kWh (sum hourly per-vehicle charge_kw across vehicles)
  // Bucket by ISO hour to avoid double-counting if adapters disagree on cadence.
  const evHourlyToday = new Map<string, number>();
  for (let vi = 0; vi < evDevices.length; vi++) {
    const series = evMonthHistories[vi]; // contains today within month
    for (const pt of series) {
      if (pt.timestamp < startToday) continue;
      const key = pt.timestamp.toISOString();
      evHourlyToday.set(key, (evHourlyToday.get(key) ?? 0) + pt.value);
    }
  }
  const totalEvKwhToday = Array.from(evHourlyToday.values()).reduce((s, v) => s + v, 0);

  // Clean energy share per hour: solar / (solar + grid_import)
  const gridHourly = new Map<string, number>();
  for (const pt of gridDayHistory) {
    gridHourly.set(pt.timestamp.toISOString(), pt.value);
  }
  let cleanEnergyKwh = 0;
  for (const [key, evKw] of evHourlyToday) {
    const solar = solarHourly.get(key) ?? 0;
    const gridImport = Math.max(0, gridHourly.get(key) ?? 0);
    const cleanShare = solar > 0 ? Math.min(1, solar / Math.max(0.001, solar + gridImport)) : 0;
    cleanEnergyKwh += evKw * cleanShare;
  }
  const cleanEnergyPct =
    totalEvKwhToday > 0 ? Math.round((cleanEnergyKwh / totalEvKwhToday) * 100) : 0;

  function deriveLastChargedLabel(weekSeries: { timestamp: Date; value: number }[], rateNow: number): string {
    if (rateNow > 0.1) return 'Now';
    // Walk back through hourly samples to find the most recent hour with charge
    const sorted = [...weekSeries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const last = sorted.find((p) => p.value > 0.1);
    if (!last) return '—';
    const at = last.timestamp;
    const ageMs = now.getTime() - at.getTime();
    const ageHr = ageMs / 3600000;
    if (ageHr < 1) return `${Math.max(1, Math.round(ageMs / 60000))} min ago`;
    if (at.toDateString() === now.toDateString()) return `Today ${fmtTime(at)}`;
    if (ageHr < 48) return `Yesterday ${fmtTime(at)}`;
    return `${Math.floor(ageHr / 24)} days ago`;
  }

  const vehicles = evDevices.map((d, i) => {
    const st = evStatuses[i];
    const cfg = context.evConfigs.find((c) => c.id === d.id)!;
    const soc = st.evSOCPercent ?? 0;
    const rate = st.evChargeRateKw ?? 0;
    const tt = timeToFull(soc, cfg);
    const status: 'charging' | 'completed' | 'disconnected' =
      rate > 0.1 ? 'charging' : soc >= cfg.target_charge * 100 - 0.5 ? 'completed' : 'disconnected';

    const lastChargedLabel = deriveLastChargedLabel(evWeekHistories[i], rate);
    const departureShort = fmtClock12h(String(cfg.departure_time).slice(0, 5));

    return {
      id: d.id,
      name: findDeviceName(context.rawDevices, d.id),
      battery_capacity_kwh: cfg.battery_capacity_kwh,
      target_charge_pct: cfg.target_charge * 100,
      battery_level_pct: Math.round(soc),
      range_mi: estimateRangeMiles(soc, cfg.battery_capacity_kwh),
      max_range_mi: estimateRangeMiles(100, cfg.battery_capacity_kwh),
      charging_status: status,
      plugged_in: st.evPluggedIn ?? false,
      charge_rate_kw: Math.round(rate * 100) / 100,
      time_to_full_label: tt.label,
      last_charged_label: lastChargedLabel,
      // Efficiency is the simulator's documented model constant. Real
      // adapters that compute actual mi/kWh from telemetry will report
      // their own value here.
      efficiency_mi_per_kwh: EV_EFFICIENCY_MI_PER_KWH,
      departure_time: cfg.departure_time,
      schedule_window_label: `${offPeakStartLabel()} – ${departureShort}`,
    };
  });

  // 24h chart: per-hour totals + per-vehicle breakdown from adapter histories
  const history24h: { time: string; total_kw: number; per_vehicle: Record<string, number> }[] = [];
  const buckets = new Map<string, { total: number; perVehicle: Record<string, number> }>();
  for (let vi = 0; vi < evDevices.length; vi++) {
    const name = findDeviceName(context.rawDevices, evDevices[vi].id);
    for (const pt of ev24hHistories[vi]) {
      const key = pt.timestamp.toISOString();
      const entry = buckets.get(key) ?? { total: 0, perVehicle: {} };
      entry.total += pt.value;
      entry.perVehicle[name] = (entry.perVehicle[name] ?? 0) + pt.value;
      buckets.set(key, entry);
    }
  }
  const sortedKeys = Array.from(buckets.keys()).sort();
  for (const key of sortedKeys) {
    const entry = buckets.get(key)!;
    history24h.push({
      time: fmtTime(new Date(key)),
      total_kw: Math.round(entry.total * 100) / 100,
      per_vehicle: Object.fromEntries(
        Object.entries(entry.perVehicle).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
    });
  }

  const totalCurrentKw = vehicles.reduce((s, v) => s + v.charge_rate_kw, 0);
  const chargingCount = vehicles.filter((v) => v.charging_status === 'charging').length;

  // Month EV kWh — sum hourly per-vehicle, deduped across cadence
  const evHourlyMonth = new Map<string, number>();
  for (let vi = 0; vi < evDevices.length; vi++) {
    for (const pt of evMonthHistories[vi]) {
      const key = pt.timestamp.toISOString();
      evHourlyMonth.set(key, (evHourlyMonth.get(key) ?? 0) + pt.value);
    }
  }
  // Suppress unused-import lint for gridMonthHistory: it's reserved for
  // future cost-savings calculations that include grid carbon weighting.
  void gridMonthHistory;
  const monthEvKwh = Array.from(evHourlyMonth.values()).reduce((s, v) => s + v, 0);
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
