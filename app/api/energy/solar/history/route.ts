import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';

export const dynamic = 'force-dynamic';

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

  const range = req.nextUrl.searchParams.get('range') ?? '24h';
  const hours = rangeToHours(range);

  const now = new Date();
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);

  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');

  // Per-device history through the adapter layer; the route only sums
  // aligned hourly buckets.
  const perDeviceSeries = await Promise.all(
    solarDevices.map((d) =>
      createAdapter(d, {
        solar: context.solarConfigs,
        persistConfig: context.persistConnectionConfig,
      }).getHistory({
        metric: 'energy_kwh',
        startDate: start,
        endDate: now,
      })
    )
  );

  const bucket = new Map<string, number>();
  for (const series of perDeviceSeries) {
    for (const pt of series) {
      const key = pt.timestamp.toISOString();
      bucket.set(key, (bucket.get(key) ?? 0) + pt.value);
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
