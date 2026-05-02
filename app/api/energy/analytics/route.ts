import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters';
import {
  aggregateMonthly,
  computeCostSavings,
  summarizeAnalytics,
  computeSolarArrayInstant,
  deriveAlerts,
} from '@/lib/simulation';
import {
  solveFlowsHistoryFromAdapters,
  solveCurrentFlowFromAdapters,
} from '@/lib/server/adapter-flows';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { z } from 'zod';

const NoQuerySchema = z.object({}).strict();

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });

  const rateLimitError = checkReadRateLimit(req, result.context.user.id);
  if (rateLimitError) return rateLimitError;
  const { context } = result;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const last7Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const battery = context.batteryConfigs[0] ?? null;
  const flowsCtx = {
    userId: context.user.id,
    rawDevices: context.rawDevices,
    solarConfigs: context.solarConfigs,
    evConfigs: context.evConfigs,
    batteryConfigs: context.batteryConfigs,
    persistConfig: context.persistConnectionConfig,
  };

  // End the previous-month window 1ms before the current month starts so the
  // inclusive history loop does not double-count the first hour of the
  // current month. All five histories are adapter-driven so configured live
  // providers feed analytics directly; roles without a real device contribute
  // 0 / empty to the aggregate (no implicit simulator fallback — see the
  // explicit-only simulator policy documented in replit.md). The simulator
  // only contributes when the user explicitly added a `provider_type:
  // 'simulated'` device for that role.
  const prevMonthEnd = new Date(monthStart.getTime() - 1);
  const [todayFlows, monthFlows, prevMonthFlows, yearFlows, trendFlows, currentFlow] =
    await Promise.all([
      solveFlowsHistoryFromAdapters(startToday, now, flowsCtx),
      solveFlowsHistoryFromAdapters(monthStart, now, flowsCtx),
      solveFlowsHistoryFromAdapters(prevMonthStart, prevMonthEnd, flowsCtx),
      solveFlowsHistoryFromAdapters(yearStart, now, flowsCtx),
      solveFlowsHistoryFromAdapters(last7Months, now, flowsCtx),
      solveCurrentFlowFromAdapters(flowsCtx),
    ]);

  // Evaluate panel health at solar noon and as a ratio to each array's own
  // average. The per-panel weather model is a simulator construct — real
  // providers don't expose per-panel telemetry — so we only compute this
  // for arrays the user has explicitly added as `simulated`. For real
  // providers we leave it null and the analytics UI omits the metric.
  const solarNoon = new Date(now);
  solarNoon.setHours(12, 0, 0, 0);
  const simulatedSolarConfigs = context.solarConfigs.filter((cfg) => {
    const dev = context.rawDevices.find((d) => d.id === cfg.id);
    return dev?.provider_type === 'simulated';
  });
  let panelOptimalRatio: number | null = null;
  if (simulatedSolarConfigs.length > 0) {
    let totalPanels = 0;
    let totalOptimal = 0;
    for (const cfg of simulatedSolarConfigs) {
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

  // Battery health: average across batteries that actually report it. We
  // never default to a placeholder constant — when no adapter exposes
  // health, downstream callers (UI, system-health composite) treat it as
  // "unknown" rather than fabricating 100%.
  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');
  let batteryHealthPct: number | null = null;
  if (batteryDevices.length > 0) {
    const statuses = await Promise.all(
      batteryDevices.map((d) =>
        createAdapter(d, {
          solar: context.solarConfigs,
          ev: context.evConfigs,
          battery: context.batteryConfigs.find((b) => b.id === d.id) ?? null,
          persistConfig: context.persistConnectionConfig,
        }).getStatus()
      )
    );
    const reported = statuses
      .map((s) => s.batteryHealthPct)
      .filter((v): v is number => typeof v === 'number');
    if (reported.length > 0) {
      batteryHealthPct =
        reported.reduce((s, v) => s + v, 0) / reported.length;
    }
  }

  // Solar panel health input for alerts: only meaningful for simulated
  // arrays (real providers don't expose per-panel telemetry). Pass
  // `undefined` for real-provider arrays so deriveAlerts skips the
  // panel-condition check rather than firing against fabricated data.
  const solarPanelInstant = simulatedSolarConfigs[0]
    ? computeSolarArrayInstant(simulatedSolarConfigs[0], now)
    : undefined;
  const alerts = deriveAlerts({
    now,
    current: currentFlow,
    todayFlows,
    solarPanelInstant,
    batteryHealthPct,
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
