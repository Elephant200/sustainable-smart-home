import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { pickHouseDevice } from '@/lib/server/system-devices';
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
  const range = qr.data.range ?? '24h';
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
