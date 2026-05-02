import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters';
import { computeSolarArrayInstant, deriveAlerts } from '@/lib/simulation';
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

  const flowsCtx = {
    userId: context.user.id,
    rawDevices: context.rawDevices,
    solarConfigs: context.solarConfigs,
    evConfigs: context.evConfigs,
    batteryConfigs: context.batteryConfigs,
    persistConfig: context.persistConnectionConfig,
  };
  const [todayFlows, current] = await Promise.all([
    solveFlowsHistoryFromAdapters(startToday, now, flowsCtx),
    solveCurrentFlowFromAdapters(flowsCtx),
  ]);

  // Per-panel telemetry is a simulator construct; only feed it to the
  // alerts engine when the array was explicitly added as `simulated`.
  // Real-provider arrays leave this `undefined` so the panel-condition
  // alert is skipped rather than computed against fabricated data.
  const simulatedSolarConfig = context.solarConfigs.find((cfg) => {
    const dev = context.rawDevices.find((d) => d.id === cfg.id);
    return dev?.provider_type === 'simulated';
  });
  const solarPanelInstant = simulatedSolarConfig
    ? computeSolarArrayInstant(simulatedSolarConfig, now)
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
