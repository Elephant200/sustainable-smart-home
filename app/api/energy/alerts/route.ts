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

  // Battery health for alerting: average across batteries that actually
  // report it. When no provider exposes health we pass `null`, and
  // deriveAlerts simply skips the health-based alert (vs. defaulting to 100
  // which would silently suppress the alert under fake data).
  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');
  let batteryHealthPct: number | null = null;
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
    const reported = statuses
      .map((s) => s.batteryHealthPct)
      .filter((v): v is number => typeof v === 'number');
    if (reported.length > 0) {
      batteryHealthPct =
        reported.reduce((s, v) => s + v, 0) / reported.length;
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
