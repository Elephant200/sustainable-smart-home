import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { pickHouseDevice } from '@/lib/server/system-devices';

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

  // House history requires a configured house device — either a real
  // provider (Home Assistant, Emporia, etc.) or one the user has
  // explicitly added as `simulated`. With no house device at all we
  // return an empty series and `has_house: false` so the UI can prompt
  // the user to add one in Settings instead of showing fabricated data.
  const houseDevice = pickHouseDevice(context.rawDevices);
  if (!houseDevice) {
    return NextResponse.json({ range, points: [], has_house: false });
  }

  const series = await createAdapter(houseDevice, {
    persistConfig: context.persistConnectionConfig,
  }).getHistory({
    metric: 'energy_kwh',
    startDate: start,
    endDate: now,
  });

  const points = series.map((pt) => ({
    timestamp: pt.timestamp.toISOString(),
    energy_kwh: Math.round(pt.value * 100) / 100,
  }));

  return NextResponse.json({ range, points, has_house: true });
}
