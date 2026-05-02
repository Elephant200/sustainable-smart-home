import { NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import {
  solveFlows,
  solveFlowsHistory,
  aggregateMonthly,
  computeCostSavings,
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
  const last7Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const battery = context.batteryConfigs[0] ?? null;

  const [todayFlows, monthFlows, yearFlows, trendFlows] = [
    solveFlowsHistory(startToday, now, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(monthStart, now, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(yearStart, now, context.solarConfigs, context.evConfigs, battery),
    solveFlowsHistory(last7Months, now, context.solarConfigs, context.evConfigs, battery),
  ];

  const currentFlow = solveFlows(now, context.solarConfigs, context.evConfigs, battery);
  const summary = summarizeAnalytics(
    todayFlows,
    monthFlows,
    yearFlows,
    currentFlow,
    battery?.capacity_kwh ?? 0
  );
  const monthly = aggregateMonthly(trendFlows);
  const costSavings = computeCostSavings(monthFlows);

  return NextResponse.json({ summary, monthly, costSavings });
}
