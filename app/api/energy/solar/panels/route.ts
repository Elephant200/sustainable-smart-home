import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import {
  computeSolarArrayInstant,
  solveFlows,
  solveFlowsHistory,
  summarizeAnalytics,
} from '@/lib/simulation';

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
  const arrays = context.solarConfigs.map((cfg) => {
    const inst = computeSolarArrayInstant(cfg, now);
    const ratedKw = cfg.panel_count * cfg.output_per_panel_kw;
    const efficiency_pct =
      ratedKw > 0 ? (inst.total_output_kw / ratedKw) * 100 : 0;
    return {
      id: cfg.id,
      name: findDeviceName(context.rawDevices, cfg.id),
      panel_count: cfg.panel_count,
      output_per_panel_kw: cfg.output_per_panel_kw,
      rated_kw: ratedKw,
      current_kw: Math.round(inst.total_output_kw * 1000) / 1000,
      efficiency_pct: Math.round(efficiency_pct),
      weather_factor: Math.round(inst.weather_factor * 100) / 100,
      panels: inst.per_panel.map((p) => {
        let status: 'optimal' | 'good' | 'maintenance' = 'optimal';
        if (p.efficiency_pct < 50) status = 'maintenance';
        else if (p.efficiency_pct < 80) status = 'good';
        return {
          panel_id: p.panel_index + 1,
          production_kw: Math.round(p.output_kw * 1000) / 1000,
          efficiency_pct: p.efficiency_pct,
          status,
        };
      }),
    };
  });

  const todayFlows = solveFlowsHistory(
    startToday,
    now,
    context.solarConfigs,
    context.evConfigs,
    battery
  );
  const monthFlows = solveFlowsHistory(
    monthStart,
    now,
    context.solarConfigs,
    context.evConfigs,
    battery
  );
  const yearFlows = solveFlowsHistory(
    yearStart,
    now,
    context.solarConfigs,
    context.evConfigs,
    battery
  );
  const currentFlow = solveFlows(now, context.solarConfigs, context.evConfigs, battery);
  const summary = summarizeAnalytics(
    todayFlows,
    monthFlows,
    yearFlows,
    currentFlow,
    battery?.capacity_kwh ?? 0
  );

  return NextResponse.json({ arrays, summary });
}
