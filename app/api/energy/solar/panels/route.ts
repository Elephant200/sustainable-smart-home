import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { computeSolarArrayInstant, summarizeAnalytics } from '@/lib/simulation';
import {
  solveFlowsHistoryFromAdapters,
  solveCurrentFlowFromAdapters,
} from '@/lib/server/adapter-flows';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const battery = context.batteryConfigs[0] ?? null;

  // Per-array data: one card per *actual* solar array device. `current_kw`
  // comes straight from the adapter — for real providers (Enphase /
  // SolarEdge / Tesla) it's the live reading; for user-added simulated
  // arrays the SimulatedAdapter computes it from the per-panel weather
  // model. We never substitute simulator output for a real provider whose
  // status call failed; the array's `current_kw` stays 0 and `is_live`
  // surfaces the outage to the UI.
  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');
  const adapterCtx = {
    solar: context.solarConfigs,
    ev: context.evConfigs,
    battery,
    persistConfig: context.persistConnectionConfig,
  };
  const solarStatuses = await Promise.all(
    solarDevices.map((d) => createAdapter(d, adapterCtx).getStatus())
  );

  const arrays = context.solarConfigs.map((cfg) => {
    const ratedKw = cfg.panel_count * cfg.output_per_panel_kw;
    const device = solarDevices.find((d) => d.id === cfg.id);
    const isSimulated = device?.provider_type === 'simulated';
    const liveStatus = solarStatuses.find((s) => s.deviceId === cfg.id);
    const isLive = liveStatus?.isLive !== false;
    const currentKw = liveStatus?.solarOutputKw ?? 0;

    // weather_factor is a simulator construct (no real provider exposes
    // per-array irradiance modeling). Only emit it for arrays the user
    // explicitly added as `simulated`; for real-provider arrays it's null
    // and the UI omits the badge.
    const weatherFactor = isSimulated
      ? Math.round(computeSolarArrayInstant(cfg, now).weather_factor * 100) / 100
      : null;

    const efficiency_pct = ratedKw > 0 ? (currentKw / ratedKw) * 100 : 0;
    let status: 'optimal' | 'good' | 'maintenance' = 'optimal';
    if (efficiency_pct < 50) status = 'maintenance';
    else if (efficiency_pct < 80) status = 'good';

    return {
      id: cfg.id,
      name: findDeviceName(context.rawDevices, cfg.id),
      panel_count: cfg.panel_count,
      output_per_panel_kw: cfg.output_per_panel_kw,
      rated_kw: Math.round(ratedKw * 100) / 100,
      current_kw: Math.round(currentKw * 1000) / 1000,
      efficiency_pct: Math.round(efficiency_pct),
      weather_factor: weatherFactor,
      is_live: isLive,
      status,
    };
  });

  const flowsCtx = {
    userId: context.user.id,
    rawDevices: context.rawDevices,
    solarConfigs: context.solarConfigs,
    evConfigs: context.evConfigs,
    batteryConfigs: context.batteryConfigs,
    persistConfig: context.persistConnectionConfig,
  };
  const [todayFlows, monthFlows, yearFlows, currentFlow] = await Promise.all([
    solveFlowsHistoryFromAdapters(startToday, now, flowsCtx),
    solveFlowsHistoryFromAdapters(monthStart, now, flowsCtx),
    solveFlowsHistoryFromAdapters(yearStart, now, flowsCtx),
    solveCurrentFlowFromAdapters(flowsCtx),
  ]);
  const summary = summarizeAnalytics(
    todayFlows,
    monthFlows,
    yearFlows,
    currentFlow,
    battery?.capacity_kwh ?? 0
  );

  return NextResponse.json({ arrays, summary });
}
