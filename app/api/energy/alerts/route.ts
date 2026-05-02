import { NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import {
  solveFlows,
  solveFlowsHistory,
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

  const battery = context.batteryConfigs[0] ?? null;
  const todayFlows = solveFlowsHistory(
    startToday,
    now,
    context.solarConfigs,
    context.evConfigs,
    battery
  );
  const current = solveFlows(now, context.solarConfigs, context.evConfigs, battery);

  const solarPanelInstant = context.solarConfigs[0]
    ? computeSolarArrayInstant(context.solarConfigs[0], now)
    : undefined;

  // Derive battery health from module count the same way analytics does so
  // alerts and analytics agree on a single source of truth.
  const moduleCount = battery ? 4 : 0;
  const batteryHealthPct = battery
    ? Array.from({ length: moduleCount }, (_, i) => 96 + (i % 4)).reduce(
        (s, v) => s + v,
        0
      ) / Math.max(1, moduleCount)
    : 100;

  const alerts = deriveAlerts({
    now,
    current,
    todayFlows,
    solarPanelInstant,
    batteryHealthPct,
    evCount: context.evConfigs.length,
  });

  return NextResponse.json({ alerts });
}
