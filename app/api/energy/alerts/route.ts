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

  const alerts = deriveAlerts({
    now,
    current,
    todayFlows,
    solarPanelInstant,
    batteryHealthPct: 98,
    evCount: context.evConfigs.length,
  });

  return NextResponse.json({ alerts });
}
