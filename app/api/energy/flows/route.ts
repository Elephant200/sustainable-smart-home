import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext } from '@/lib/server/device-context';
import { createClient } from '@/lib/supabase/server';
import { solveFlowsHistoryFromAdapters } from '@/lib/server/adapter-flows';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RangeQuerySchema = z.object({
  range: z.enum(['24h', '7d', '3m', '1y']).default('24h'),
}).strict();

function rangeToStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '3m':  return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

/**
 * Check whether fresh energy_flows rows exist for specific live device IDs
 * within the window. Returns true only when at least one of the given devices
 * has a persisted row, signalling the cron has run for those devices.
 *
 * Using the session client so RLS applies — the user can only see their own rows.
 */
async function hasPersistedFlowsForDevices(
  deviceIds: string[],
  startDate: Date
): Promise<boolean> {
  if (deviceIds.length === 0) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from('energy_flows')
    .select('timestamp')
    .in('source_device_id', deviceIds)
    .gte('timestamp', startDate.toISOString())
    .eq('resolution', '1hr')
    .limit(1)
    .single();
  return data != null;
}

/**
 * Build a per-hour flow series from the four persisted tables, covering only
 * the live (non-simulated) device data that the background cron has written.
 *
 * The background cron writes to:
 *   - energy_flows         → solar and grid flow edges (per hour, 1hr resolution)
 *   - ev_charge_sessions   → EV charging energy per device per hour
 *   - house_load           → metered house consumption per hour
 *   - battery_state        → battery SoC snapshots (soc_percent, soc_kwh — no power_kw)
 *
 * house_kw is read directly from house_load (not derived) so it is accurate
 * even when a battery is active. battery_kw is then derived via the nodal
 * energy balance: battery = solar + net_grid - house - ev.
 * When house_load has no row for an hour, battery_kw falls back to 0.
 *
 * Returns a Map<isoHour, PersistedPoint> keyed by UTC-hour ISO string so
 * callers can merge simulated-device contributions on top.
 */
async function readPersistedFlows(
  userId: string,
  startDate: Date,
  endDate: Date,
  evDeviceIds: string[],
  batteryDeviceIds: string[]
): Promise<Map<string, {
  solar_kwh: number;
  house_kwh: number;
  ev_kwh: number;
  battery_soc_percent: number;
  battery_power_kw: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  has_house_row: boolean;
}>> {
  const supabase = await createClient();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const [flowsResult, evResult, houseResult, batteryResult] = await Promise.all([
    supabase
      .from('energy_flows')
      .select('timestamp, source, target, energy_kwh')
      .eq('user_id', userId)
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .eq('resolution', '1hr')
      .order('timestamp', { ascending: true }),
    evDeviceIds.length > 0
      ? supabase
          .from('ev_charge_sessions')
          .select('timestamp, energy_kwh_from_grid, energy_kwh_from_solar, energy_kwh_from_battery')
          .in('device_id', evDeviceIds)
          .gte('timestamp', startIso)
          .lte('timestamp', endIso)
          .eq('resolution', '1hr')
      : Promise.resolve({ data: [] as Array<{
          timestamp: string;
          energy_kwh_from_grid: number | null;
          energy_kwh_from_solar: number | null;
          energy_kwh_from_battery: number | null;
        }>, error: null }),
    supabase
      .from('house_load')
      .select('timestamp, energy_kwh')
      .eq('user_id', userId)
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .eq('resolution', '1hr'),
    // Include device_id for per-device delta math (multi-battery correctness).
    // Fetch one extra hour before the window to compute the first-hour SoC delta.
    batteryDeviceIds.length > 0
      ? supabase
          .from('battery_state')
          .select('device_id, timestamp, soc_percent, soc_kwh')
          .in('device_id', batteryDeviceIds)
          .gte('timestamp', new Date(startDate.getTime() - 60 * 60 * 1000).toISOString())
          .lte('timestamp', endIso)
          .order('timestamp', { ascending: true })
      : Promise.resolve({ data: [] as Array<{
          device_id: string;
          timestamp: string;
          soc_percent: number | null;
          soc_kwh: number | null;
        }>, error: null }),
  ]);

  if (flowsResult.error) console.warn('[flows] energy_flows query error:', flowsResult.error.message);
  if (houseResult.error) console.warn('[flows] house_load query error:', houseResult.error.message);

  const allTimestamps = new Set<string>();
  for (const row of flowsResult.data ?? []) allTimestamps.add(row.timestamp);
  for (const row of evResult.data ?? []) allTimestamps.add(row.timestamp);
  for (const row of houseResult.data ?? []) allTimestamps.add(row.timestamp);
  // Battery rows include one extra lookback hour used only for delta computation.
  // Do NOT add that pre-range hour to allTimestamps — only add hours within the window.
  for (const row of batteryResult.data ?? []) {
    const ts = new Date(row.timestamp); ts.setMinutes(0, 0, 0);
    const iso = ts.toISOString();
    if (iso >= startIso) allTimestamps.add(iso);
  }

  const flowsByHour = new Map<string, { solar_kwh: number; grid_import_kwh: number; grid_export_kwh: number }>();
  for (const row of flowsResult.data ?? []) {
    const b = flowsByHour.get(row.timestamp) ?? { solar_kwh: 0, grid_import_kwh: 0, grid_export_kwh: 0 };
    if (row.source === 'solar') b.solar_kwh += row.energy_kwh ?? 0;
    if (row.source === 'grid') b.grid_import_kwh += row.energy_kwh ?? 0;
    if (row.target === 'grid') b.grid_export_kwh += row.energy_kwh ?? 0;
    flowsByHour.set(row.timestamp, b);
  }

  const evByHour = new Map<string, number>();
  for (const row of evResult.data ?? []) {
    const total = (row.energy_kwh_from_grid ?? 0) +
                  (row.energy_kwh_from_solar ?? 0) +
                  (row.energy_kwh_from_battery ?? 0);
    evByHour.set(row.timestamp, (evByHour.get(row.timestamp) ?? 0) + total);
  }

  const houseByHour = new Map<string, number>();
  for (const row of houseResult.data ?? []) {
    houseByHour.set(row.timestamp, (houseByHour.get(row.timestamp) ?? 0) + (row.energy_kwh ?? 0));
  }

  // Build battery SoC and power-kw maps from battery_state.
  // Battery power for each hour is derived from the SoC-kWh delta between
  // consecutive hours: positive = charging (energy flowing into battery),
  // negative = discharging. This is accurate regardless of which destinations
  // solar energy flows to, unlike the nodal-balance approach which assumed
  // solar → house only.
  //
  // Multi-battery handling: compute per-device SoC-delta first, then sum
  // contributions per hour. This correctly handles batteries with offsetting
  // SoC changes (e.g. one charging while another discharges).

  // Group rows by device_id, deduplicating to ONE row per device per hour bucket.
  // battery_state stores snapshot rows at exact cron timestamps (not hour-rounded),
  // so cron may write multiple rows within the same hour. We keep the LAST sample
  // per hour per device (highest timestamp wins) to represent end-of-hour SoC.
  // Sorting all source rows ascending by timestamp means the last write for each
  // device+hour bucket naturally overwrites earlier ones in the map.
  const battLastPerDeviceHour = new Map<string, { ts: string; soc_kwh: number; soc_percent: number }>();
  for (const row of batteryResult.data ?? []) {
    const ts = new Date(row.timestamp); ts.setMinutes(0, 0, 0);
    const bucket = ts.toISOString();
    const key = `${row.device_id}|${bucket}`;
    // Rows are already sorted ascending by timestamp, so later rows overwrite — last wins.
    battLastPerDeviceHour.set(key, {
      ts: bucket,
      soc_kwh: row.soc_kwh ?? 0,
      soc_percent: row.soc_percent ?? 0,
    });
  }

  // Rebuild per-device lists from the deduplicated map, sorted ascending by hour.
  const battRowsByDevice = new Map<string, Array<{ ts: string; soc_kwh: number; soc_percent: number }>>();
  for (const [key, entry] of battLastPerDeviceHour) {
    const deviceId = key.split('|')[0];
    const list = battRowsByDevice.get(deviceId) ?? [];
    list.push(entry);
    battRowsByDevice.set(deviceId, list);
  }
  for (const list of battRowsByDevice.values()) {
    list.sort((a, b) => a.ts.localeCompare(b.ts));
  }

  // Per-hour power delta: for each device compute Δsoc_kwh between consecutive
  // deduplicated hour-buckets (one row per device per hour), then sum across devices.
  // This correctly handles multi-battery fleets and avoids intra-hour deltas.
  const battPowerByHour = new Map<string, number>();
  const battSocSumByHour = new Map<string, number>();
  const battDeviceCountByHour = new Map<string, number>();

  for (const rows of battRowsByDevice.values()) {
    for (let i = 1; i < rows.length; i++) {
      const hour = rows[i].ts;
      const delta = rows[i].soc_kwh - rows[i - 1].soc_kwh;
      battPowerByHour.set(hour, (battPowerByHour.get(hour) ?? 0) + delta);
    }
    for (const r of rows) {
      battSocSumByHour.set(r.ts, (battSocSumByHour.get(r.ts) ?? 0) + r.soc_percent);
      battDeviceCountByHour.set(r.ts, (battDeviceCountByHour.get(r.ts) ?? 0) + 1);
    }
  }

  // Average soc_percent across batteries for display.
  const battSocByHour = new Map<string, number>();
  for (const [key, total] of battSocSumByHour) {
    battSocByHour.set(key, total / (battDeviceCountByHour.get(key) ?? 1));
  }

  const out = new Map<string, {
    solar_kwh: number;
    house_kwh: number;
    ev_kwh: number;
    battery_soc_percent: number;
    battery_power_kw: number;
    grid_import_kwh: number;
    grid_export_kwh: number;
    has_house_row: boolean;
  }>();

  for (const timestamp of allTimestamps) {
    const f = flowsByHour.get(timestamp) ?? { solar_kwh: 0, grid_import_kwh: 0, grid_export_kwh: 0 };
    const has_house_row = houseByHour.has(timestamp);
    out.set(timestamp, {
      solar_kwh: f.solar_kwh,
      house_kwh: houseByHour.get(timestamp) ?? 0,
      ev_kwh: evByHour.get(timestamp) ?? 0,
      battery_soc_percent: battSocByHour.get(timestamp) ?? 0,
      battery_power_kw: battPowerByHour.get(timestamp) ?? 0,
      grid_import_kwh: f.grid_import_kwh,
      grid_export_kwh: f.grid_export_kwh,
      has_house_row,
    });
  }

  return out;
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
  const startDate = rangeToStartDate(range);
  const endDate = new Date();

  const liveDevices = context.rawDevices.filter((d) => d.provider_type !== 'simulated');
  const simulatedDevices = context.rawDevices.filter((d) => d.provider_type === 'simulated');
  const hasLiveDevices = liveDevices.length > 0;

  // When the user has real (non-simulated) devices and the background cron
  // has persisted data, read from the four DB tables (energy_flows,
  // ev_charge_sessions, house_load, battery_state). Then merge in any
  // explicitly-configured simulated devices via the adapter path so that
  // mixed live+simulated setups see a complete picture.
  // Use the live solar/grid device IDs to scope the persisted-data check.
  // Checking against source_device_id ensures we only consider actual cron-written
  // rows, not rows from other tables that share user_id.
  const liveSolarAndGridIds = liveDevices
    .filter((d) => d.type === 'solar_array' || d.type === 'grid')
    .map((d) => d.id);

  if (hasLiveDevices && await hasPersistedFlowsForDevices(liveSolarAndGridIds, startDate)) {
    const evDeviceIds = liveDevices
      .filter((d) => d.type === 'ev').map((d) => d.id);
    const batteryDeviceIds = liveDevices
      .filter((d) => d.type === 'battery').map((d) => d.id);

    const persistedByHour = await readPersistedFlows(
      context.user.id, startDate, endDate, evDeviceIds, batteryDeviceIds
    );

    // Adapter series for simulated devices only (if any exist alongside live devices).
    let simulatedSeries: Awaited<ReturnType<typeof solveFlowsHistoryFromAdapters>> = [];
    if (simulatedDevices.length > 0) {
      simulatedSeries = await solveFlowsHistoryFromAdapters(startDate, endDate, {
        userId: context.user.id,
        rawDevices: simulatedDevices,
        solarConfigs: context.solarConfigs,
        evConfigs: context.evConfigs,
        batteryConfigs: context.batteryConfigs,
        persistConfig: context.persistConnectionConfig,
      });
    }

    const simByHour = new Map(
      simulatedSeries.map((s) => [s.timestamp.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00.000Z'), s])
    );

    // Union of all hours from persisted and simulated data.
    const allHours = new Set([...persistedByHour.keys()]);
    for (const s of simulatedSeries) {
      const k = new Date(s.timestamp); k.setMinutes(0, 0, 0);
      allHours.add(k.toISOString());
    }

    const points = [...allHours].sort().map((timestamp) => {
      const p = persistedByHour.get(timestamp);
      const sim = simByHour.get(timestamp);

      // Separate live (persisted) and simulated contributions before merging.
      const live_solar = p?.solar_kwh ?? 0;
      const live_house = p?.house_kwh ?? 0;
      const live_ev = p?.ev_kwh ?? 0;
      const live_net_grid = p != null ? p.grid_import_kwh - p.grid_export_kwh : 0;
      // Battery power comes from the SoC-delta computation in readPersistedFlows —
      // accurate regardless of where solar energy was routed (house / battery / EV / grid).
      const live_battery_kw = p?.battery_power_kw ?? 0;

      const sim_solar = sim?.solar_kw ?? 0;
      const sim_house = sim?.house_kw ?? 0;
      const sim_ev = sim?.ev_kw ?? 0;
      const sim_grid = sim?.grid_kw ?? 0;
      const sim_battery = sim?.battery_power_kw ?? 0;

      // Merged totals: live + simulated contributions summed per role.
      const solar_kwh = live_solar + sim_solar;
      const house_kwh = live_house + sim_house;
      const ev_kwh = live_ev + sim_ev;
      const net_grid = live_net_grid + sim_grid;
      const battery_kw = live_battery_kw + sim_battery;
      const battery_soc_percent = (p?.battery_soc_percent ?? 0) ||
        (sim?.battery_soc_percent ?? 0);

      return {
        timestamp,
        solar_kw: Math.round(solar_kwh * 100) / 100,
        house_kw: Math.round(house_kwh * 100) / 100,
        ev_kw: Math.round(ev_kwh * 100) / 100,
        battery_kw: Math.round(battery_kw * 100) / 100,
        battery_soc_percent: Math.round(battery_soc_percent * 10) / 10,
        grid_kw: Math.round(net_grid * 100) / 100,
      };
    });

    return NextResponse.json({ range, points });
  }

  // Fallback: adapter-driven series for all devices (simulated + live before
  // the first cron sync). Includes both real providers and simulated devices
  // as configured by the user.
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
