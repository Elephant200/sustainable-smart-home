import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createClient } from '@/lib/supabase/server';
import { createAdapter } from '@/lib/adapters/factory';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RangeQuerySchema = z.object({
  range: z.enum(['24h', '7d', '3m', '1y']).default('24h'),
}).strict();

function rangeToHours(range: string): number {
  switch (range) {
    case '24h': return 25;
    case '7d':  return 7 * 24;
    case '3m':  return 3 * 30 * 24;
    case '1y':  return 365 * 24;
    default:    return 25;
  }
}

export async function GET(req: NextRequest) {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const rateLimitError = checkReadRateLimit(req, context.user.id);
  if (rateLimitError) return rateLimitError;

  const qr = validateQuery(RangeQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;
  const range = (qr.data as { range?: string }).range ?? '24h';
  const hours = rangeToHours(range);

  const now = new Date();
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);

  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');
  const liveDevices = solarDevices.filter((d) => d.provider_type !== 'simulated');
  const simDevices = solarDevices.filter((d) => d.provider_type === 'simulated');
  const liveDeviceIds = liveDevices.map((d) => d.id);

  // Per-hour energy bucket — all contributions (live persisted + simulated adapter) accumulate here.
  const bucket = new Map<string, number>();

  // Live devices: prefer persisted energy_flows rows written by the background cron.
  // Mixed live+simulated fleet: always merge simulated adapter output on top, so that
  // explicitly-configured simulated arrays are never dropped once live data exists.
  if (liveDeviceIds.length > 0) {
    const supabase = await createClient();
    const { data: check } = await supabase
      .from('energy_flows')
      .select('timestamp')
      .in('source_device_id', liveDeviceIds)
      .eq('source', 'solar')
      .gte('timestamp', start.toISOString())
      .eq('resolution', '1hr')
      .limit(1)
      .single();

    if (check) {
      // Cron data exists — read persisted live rows.
      const { data: rows } = await supabase
        .from('energy_flows')
        .select('timestamp, energy_kwh')
        .in('source_device_id', liveDeviceIds)
        .eq('source', 'solar')
        .gte('timestamp', start.toISOString())
        .lte('timestamp', now.toISOString())
        .eq('resolution', '1hr')
        .order('timestamp', { ascending: true });

      for (const row of rows ?? []) {
        bucket.set(row.timestamp, (bucket.get(row.timestamp) ?? 0) + (row.energy_kwh ?? 0));
      }
    } else {
      // No cron data yet — fall back to live adapter calls for live devices.
      const liveSeriesArray = await Promise.all(
        liveDevices.map((d) =>
          createAdapter(d, {
            solar: context.solarConfigs,
            persistConfig: context.persistConnectionConfig,
          }).getHistory({ metric: 'energy_kwh', startDate: start, endDate: now })
        )
      );
      for (const series of liveSeriesArray) {
        for (const pt of series) {
          const key = pt.timestamp.toISOString();
          bucket.set(key, (bucket.get(key) ?? 0) + pt.value);
        }
      }
    }
  }

  // Simulated devices: always call adapter regardless of live data availability.
  // The user explicitly added these devices — they must appear in the output.
  if (simDevices.length > 0) {
    const simSeriesArray = await Promise.all(
      simDevices.map((d) =>
        createAdapter(d, {
          solar: context.solarConfigs,
          persistConfig: context.persistConnectionConfig,
        }).getHistory({ metric: 'energy_kwh', startDate: start, endDate: now })
      )
    );
    for (const series of simSeriesArray) {
      for (const pt of series) {
        const key = pt.timestamp.toISOString();
        bucket.set(key, (bucket.get(key) ?? 0) + pt.value);
      }
    }
  }

  const points = Array.from(bucket.entries())
    .map(([timestamp, total]) => ({
      timestamp,
      total_generation_kwh: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return NextResponse.json({ range, points });
}
