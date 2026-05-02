import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { solveFlowsHistoryFromAdapters } from '@/lib/server/adapter-flows';

export const dynamic = 'force-dynamic';

function rangeToStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '3m':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

export async function GET(req: NextRequest) {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const range = req.nextUrl.searchParams.get('range') ?? '24h';
  const startDate = rangeToStartDate(range);
  const endDate = new Date();

  // Adapter-driven flow series: live data from configured providers, with
  // simulated fallback only for roles that have no real device.
  const series = await solveFlowsHistoryFromAdapters(startDate, endDate, {
    userId: context.user.id,
    rawDevices: context.rawDevices,
    solarConfigs: context.solarConfigs,
    evConfigs: context.evConfigs,
    batteryConfigs: context.batteryConfigs,
    persistConfig: context.persistConnectionConfig,
  });

  return NextResponse.json({
    range,
    points: series.map((s) => ({
      timestamp: s.timestamp.toISOString(),
      solar_kw: Math.round(s.solar_kw * 100) / 100,
      house_kw: Math.round(s.house_kw * 100) / 100,
      ev_kw: Math.round(s.ev_kw * 100) / 100,
      battery_kw: Math.round(s.battery_power_kw * 100) / 100,
      battery_soc_percent: Math.round(s.battery_soc_percent * 10) / 10,
      grid_kw: Math.round(s.grid_kw * 100) / 100,
    })),
  });
}
