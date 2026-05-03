/**
 * GET /api/health
 *
 * Public health-check endpoint suitable for uptime monitors.
 * Returns no per-user data.
 *
 * Response shape:
 * {
 *   status: 'ok' | 'degraded',
 *   version: string,
 *   db: { ok: boolean, latency_ms: number },
 *   providers: {
 *     [provider]: { total: number, disconnected: number }
 *   }
 * }
 *
 * HTTP 200 when database is reachable, 503 otherwise.
 * Always sets Cache-Control: no-store so monitors get a fresh reading.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/health' });

const PROVIDERS = ['simulated', 'tesla', 'enphase', 'home_assistant', 'solaredge', 'emporia'] as const;

export async function GET(req: NextRequest) {
  const reqLog = log.child({ request_id: req.headers.get('x-request-id') ?? undefined });
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION ??
    process.env.npm_package_version ??
    'unknown';

  let dbOk = false;
  let dbLatencyMs = -1;
  const providerSummary: Record<string, { total: number; disconnected: number }> = {};

  const t0 = Date.now();
  try {
    // createServiceClient() throws when env vars are absent — catch it here
    // so the endpoint returns a degraded 503 instead of an uncaught 500.
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase = createServiceClient();

    const { error } = await supabase.from('devices').select('id', { count: 'exact', head: true });
    dbLatencyMs = Date.now() - t0;
    dbOk = !error;

    if (dbOk) {
      try {
        const { data: syncRows } = await supabase
          .from('device_sync_state')
          .select('device_id, consecutive_failures');

        const { data: deviceRows } = await supabase
          .from('devices')
          .select('id, provider_type')
          .eq('is_active', true);

        const failuresByDevice = new Map<string, number>();
        for (const row of syncRows ?? []) {
          failuresByDevice.set(row.device_id, row.consecutive_failures ?? 0);
        }

        for (const provider of PROVIDERS) {
          const devicesForProvider = (deviceRows ?? []).filter(
            (d) => d.provider_type === provider
          );
          const total = devicesForProvider.length;
          const disconnected = devicesForProvider.filter(
            (d) => (failuresByDevice.get(d.id) ?? 0) >= 3
          ).length;
          if (total > 0) {
            providerSummary[provider] = { total, disconnected };
          }
        }
      } catch {
        // Provider summary is best-effort; DB reachability is the critical signal.
      }
    }
  } catch {
    dbLatencyMs = Date.now() - t0;
    dbOk = false;
  }

  const status = dbOk ? 'ok' : 'degraded';

  if (!dbOk) {
    reqLog.warn('health check degraded: db unreachable', { db_latency_ms: dbLatencyMs });
  } else {
    reqLog.info('health check ok', { db_latency_ms: dbLatencyMs, provider_count: Object.keys(providerSummary).length });
  }

  return NextResponse.json(
    {
      status,
      version,
      db: { ok: dbOk, latency_ms: dbLatencyMs },
      providers: providerSummary,
    },
    {
      status: dbOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
