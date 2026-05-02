import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { computeTotalSolarInstant } from '@/lib/simulation';

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

  const points: { timestamp: string; total_generation_kwh: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= now) {
    const total = computeTotalSolarInstant(context.solarConfigs, cursor);
    points.push({
      timestamp: cursor.toISOString(),
      total_generation_kwh: Math.round(total * 100) / 100,
    });
    cursor.setHours(cursor.getHours() + 1);
  }

  return NextResponse.json({ range, points });
}
