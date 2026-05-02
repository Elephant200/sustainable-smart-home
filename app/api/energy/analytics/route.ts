import { NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import {
  solveFlows,
  solveFlowsHistory,
  aggregateMonthly,
  computeCostSavings,
  summarizeAnalytics,
  computeSolarArrayInstant,
  deriveAlerts,
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
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const last7Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const battery = context.batteryConfigs[0] ?? null;

  // End the previous-month window 1ms before the current month starts so the
  // inclusive history loop in solveFlowsHistory does not double-count the
  // first hour of the current month.
  const prevMonthEnd = new Date(monthStart.getTime() - 1);
  const [todayFlows, monthFlows, prevMonthFlows, yearFlows, trendFlows] = [
    solveFlowsHistory(startToday, now, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(monthStart, now, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(prevMonthStart, prevMonthEnd, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(yearStart, now, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(last7Months, now, context.solarConfigs, context.evConfigs, battery),
  ];

  const currentFlow = solveFlows(now, context.solarConfigs, context.evConfigs, battery);

  // Evaluate panel health at solar noon and as a ratio to each array's own
  // average. This isolates true panel-condition outliers from time-of-day or
  // weather effects (which apply uniformly across all panels in one array)
  // and avoids cross-array bias when arrays have different sizes/locations.
  const solarNoon = new Date(now);
  solarNoon.setHours(12, 0, 0, 0);
  let panelOptimalRatio: number | null = null;
  if (context.solarConfigs.length > 0) {
    let totalPanels = 0;
    let totalOptimal = 0;
    for (const cfg of context.solarConfigs) {
      const arr = computeSolarArrayInstant(cfg, solarNoon);
      if (arr.per_panel.length === 0) continue;
      const avgEff =
        arr.per_panel.reduce((s, p) => s + p.efficiency_pct, 0) /
        arr.per_panel.length;
      const threshold = Math.max(1, avgEff * 0.85);
      totalOptimal += arr.per_panel.filter(
        (p) => p.efficiency_pct >= threshold
      ).length;
      totalPanels += arr.per_panel.length;
    }
    if (totalPanels > 0) {
      panelOptimalRatio = totalOptimal / totalPanels;
    }
  }

  const moduleCount = battery ? 4 : 0;
  const batteryHealthPct = battery
    ? Array.from({ length: moduleCount }, (_, i) => 96 + (i % 4)).reduce(
        (s, v) => s + v,
        0
      ) / Math.max(1, moduleCount)
    : null;

  const solarPanelInstant = context.solarConfigs[0]
    ? computeSolarArrayInstant(context.solarConfigs[0], now)
    : undefined;
  const alerts = deriveAlerts({
    now,
    current: currentFlow,
    todayFlows,
    solarPanelInstant,
    batteryHealthPct: batteryHealthPct ?? 98,
    evCount: context.evConfigs.length,
  });
  const activeWarnings = alerts.filter(
    (a) => a.status === 'active' && (a.type === 'warning' || a.type === 'error')
  ).length;
  const activeWarningRatio = alerts.length > 0 ? activeWarnings / alerts.length : 0;

  const summary = summarizeAnalytics(
    todayFlows,
    monthFlows,
    yearFlows,
    currentFlow,
    battery?.capacity_kwh ?? 0,
    prevMonthFlows,
    {
      batteryHealthPct,
      panelOptimalRatio,
      activeWarningRatio,
    }
  );
  const monthly = aggregateMonthly(trendFlows);
  const costSavings = computeCostSavings(monthFlows);

  return NextResponse.json({ summary, monthly, costSavings });
}
