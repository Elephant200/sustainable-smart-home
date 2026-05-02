import { NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters';
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

  // Derive battery health by asking each battery's adapter for its modules.
  // Module count and per-module health come from the adapter (so a real
  // provider would return its own values), giving a single source of truth
  // shared with /api/energy/analytics.
  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');
  let batteryHealthPct = 100;
  if (batteryDevices.length > 0) {
    const statuses = await Promise.all(
      batteryDevices.map((d) =>
        createAdapter(d, {
          solar: context.solarConfigs,
          ev: context.evConfigs,
          battery: context.batteryConfigs.find((b) => b.id === d.id) ?? null,
        }).getStatus()
      )
    );
    const allModules = statuses.flatMap((s) => s.batteryModules ?? []);
    if (allModules.length > 0) {
      batteryHealthPct =
        allModules.reduce((s, m) => s + m.health_pct, 0) / allModules.length;
    } else {
      // Fallback to provider-reported aggregate when modules aren't exposed.
      const reported = statuses
        .map((s) => s.batteryHealthPct)
        .filter((v): v is number => typeof v === 'number');
      if (reported.length > 0) {
        batteryHealthPct =
          reported.reduce((s, v) => s + v, 0) / reported.length;
      }
    }
  }

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
