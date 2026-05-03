import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { createClient } from '@/lib/supabase/server';
import { pickGridDevice, pickHouseDevice } from '@/lib/server/system-devices';
import { estimateRangeMiles } from '@/lib/simulation';
import { allocateFlowEdges } from '@/lib/simulation/flows';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { getPollingConfig } from '@/lib/server/polling-config';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';
import type { ProviderType } from '@/lib/adapters/types';

const log = createLogger({ route: '/api/energy/snapshot' });

const NoQuerySchema = z.object({}).strict();

export const dynamic = 'force-dynamic';

/**
 * Per-device sync state from device_sync_state, used to decide whether to
 * serve persisted values (from the background cron) or make a live adapter call.
 */
interface PersistedSyncInfo {
  deviceId: string;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  /** True when the last sync was within the provider's polling cadence window. */
  isFresh: boolean;
}

async function loadSyncInfo(
  deviceIds: string[],
  providerByDeviceId: Map<string, ProviderType>
): Promise<Map<string, PersistedSyncInfo>> {
  if (deviceIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from('device_sync_state')
    .select('device_id, last_success_at, consecutive_failures')
    .in('device_id', deviceIds);

  const result = new Map<string, PersistedSyncInfo>();
  for (const row of data ?? []) {
    const lastSuccessAt = row.last_success_at ? new Date(row.last_success_at) : null;
    const providerType = providerByDeviceId.get(row.device_id) ?? 'simulated';
    const cfg = getPollingConfig(providerType as ProviderType);
    const isFresh =
      lastSuccessAt != null &&
      (Date.now() - lastSuccessAt.getTime()) / 1000 <= cfg.minIntervalSec * 2;
    result.set(row.device_id, {
      deviceId: row.device_id,
      lastSuccessAt,
      consecutiveFailures: row.consecutive_failures ?? 0,
      isFresh,
    });
  }
  return result;
}

/**
 * Validate that a persisted row's own timestamp is within the provider's
 * polling window (two-layer freshness check).
 *
 * Layer 1 (caller): device_sync_state.last_success_at is fresh.
 * Layer 2 (here):  the persisted row's own timestamp is fresh.
 *
 * This guards against the edge case where updateSyncState(success=true)
 * ran before the ingestion write completed, leaving sync_state marking
 * the device as fresh while the actual persisted row is stale.
 */
function isRowFresh(rowTimestamp: string, providerType: ProviderType): boolean {
  const cfg = getPollingConfig(providerType);
  const ageSeconds = (Date.now() - new Date(rowTimestamp).getTime()) / 1000;
  return ageSeconds <= cfg.minIntervalSec * 2;
}

/**
 * Read the most recent battery_state row for a device.
 * Returns null when no fresh row exists.
 */
async function readPersistedBatteryState(
  deviceId: string,
  providerType: ProviderType
): Promise<{ soc_percent: number; soc_kwh: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('battery_state')
    .select('soc_percent, soc_kwh, timestamp')
    .eq('device_id', deviceId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (!data) return null;
  if (!isRowFresh(data.timestamp, providerType)) return null;
  return { soc_percent: data.soc_percent ?? 0, soc_kwh: data.soc_kwh ?? 0 };
}

/**
 * Read the latest solar output kW from energy_flows for a set of live solar devices.
 *
 * Requires COMPLETE per-device coverage: fetches the most-recent row per device,
 * validates each against its own provider's polling window, and returns null
 * unless every device in the supplied list has a fresh persisted row.
 *
 * The providerByDeviceId map is used for per-device freshness window evaluation
 * so that mixed-provider solar fleets (e.g. one Enphase + one SolarEdge device)
 * are checked against their respective polling cadences, not a shared one.
 *
 * Returns null when any device is missing or stale, so the caller can fall back
 * to live adapter calls for the entire fleet.
 */
async function readPersistedSolarKw(
  solarDeviceIds: string[],
  providerByDeviceId: Map<string, ProviderType>
): Promise<number | null> {
  if (solarDeviceIds.length === 0) return null;
  const supabase = await createClient();

  // Fetch all rows for these devices ordered by device then time desc.
  // We pick the first (most recent) row per device_id from the result.
  const { data } = await supabase
    .from('energy_flows')
    .select('timestamp, energy_kwh, source_device_id')
    .in('source_device_id', solarDeviceIds)
    .eq('source', 'solar')
    .eq('resolution', '1hr')
    .order('source_device_id', { ascending: true })
    .order('timestamp', { ascending: false });

  if (!data || data.length === 0) return null;

  // Build latest-row map (first occurrence per device = most recent due to order).
  const latestByDevice = new Map<string, { timestamp: string; energy_kwh: number }>();
  for (const row of data) {
    if (!latestByDevice.has(row.source_device_id)) {
      latestByDevice.set(row.source_device_id, {
        timestamp: row.timestamp,
        energy_kwh: row.energy_kwh ?? 0,
      });
    }
  }

  // Require complete coverage with per-device provider-aware freshness.
  for (const deviceId of solarDeviceIds) {
    const entry = latestByDevice.get(deviceId);
    const providerType = providerByDeviceId.get(deviceId) ?? 'simulated';
    if (!entry || !isRowFresh(entry.timestamp, providerType as ProviderType)) return null;
  }

  // All live solar devices covered and fresh — sum kWh (1hr row: kWh = average kW).
  let total = 0;
  for (const entry of latestByDevice.values()) {
    total += entry.energy_kwh;
  }
  return total;
}

/**
 * Read the most recent EV state from ev_charge_sessions for a device.
 * Returns null when no fresh row exists.
 */
async function readPersistedEvState(
  deviceId: string,
  providerType: ProviderType
): Promise<{ soc_percent: number | null; energy_kwh_from_grid: number; plugged_in: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ev_charge_sessions')
    .select('timestamp, soc_percent, energy_kwh_from_grid, plugged_in')
    .eq('device_id', deviceId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (!data) return null;
  if (!isRowFresh(data.timestamp, providerType)) return null;
  return {
    soc_percent: data.soc_percent ?? null,
    energy_kwh_from_grid: data.energy_kwh_from_grid ?? 0,
    plugged_in: data.plugged_in ?? false,
  };
}

/**
 * Read the most recent house load from house_load for a user.
 * Returns null when no fresh row exists.
 */
async function readPersistedHouseKw(
  userId: string,
  providerType: ProviderType
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('house_load')
    .select('timestamp, energy_kwh')
    .eq('user_id', userId)
    .eq('resolution', '1hr')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (!data) return null;
  if (!isRowFresh(data.timestamp, providerType)) return null;
  // house_load stores hourly energy (kWh); for a 1hr row, kWh = average kW.
  return data.energy_kwh ?? 0;
}

/**
 * Read the most recent grid import/export kW from energy_flows for a device.
 * Returns positive value for import (grid→house), negative for export (house→grid).
 * Returns null when no fresh row exists.
 */
async function readPersistedGridKw(
  deviceId: string,
  providerType: ProviderType
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('energy_flows')
    .select('timestamp, source, target, energy_kwh')
    .eq('source_device_id', deviceId)
    .eq('resolution', '1hr')
    .in('source', ['grid', 'house'])
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (!data) return null;
  if (!isRowFresh(data.timestamp, providerType)) return null;
  // grid→house = import (positive), house→grid = export (negative).
  const isImport = data.source === 'grid';
  return isImport ? (data.energy_kwh ?? 0) : -(data.energy_kwh ?? 0);
}

export async function GET(req: NextRequest) {
  const result = await loadUserContext();
  if (result.error) return NextResponse.json(result.error.body, { status: result.error.status });

  const rateLimitError = checkReadRateLimit(req, result.context.user.id);
  if (rateLimitError) return rateLimitError;
  const { context } = result;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  const reqLog = log.child({
    request_id: req.headers.get('x-request-id') ?? undefined,
    user_id: result.context.user.id,
  });
  reqLog.info('snapshot request');

  const { rawDevices, solarConfigs, batteryConfigs, evConfigs, user } = context;

  const adapterCtx = {
    solar: solarConfigs,
    ev: evConfigs,
    battery: batteryConfigs[0] ?? null,
    persistConfig: context.persistConnectionConfig,
  };

  const solarDevices = rawDevices.filter((d) => d.type === 'solar_array');
  const batteryDevices = rawDevices.filter((d) => d.type === 'battery');
  const evDevices = rawDevices.filter((d) => d.type === 'ev');
  const houseDevice = pickHouseDevice(rawDevices);
  const gridDevice = pickGridDevice(rawDevices);

  // Load sync state for all non-simulated devices in one query.
  const liveDeviceIds = rawDevices
    .filter((d) => d.provider_type !== 'simulated')
    .map((d) => d.id);
  const providerByDeviceId = new Map<string, ProviderType>(
    rawDevices.map((d) => [d.id, d.provider_type as ProviderType])
  );
  void user;
  const syncInfoMap = await loadSyncInfo(liveDeviceIds, providerByDeviceId);

  /**
   * Two-layer freshness pattern for every real (non-simulated) device class:
   *   1. device_sync_state.isFresh — cron recently succeeded for this device.
   *   2. Persisted row's own timestamp is within the polling window.
   *
   * When both layers pass, we serve the persisted value instead of making a
   * live provider API call, reducing latency and quota consumption.
   * On any miss, we fall back to the live adapter call.
   */

  // Solar: prefer energy_flows for live devices; always call adapter for simulated devices.
  //
  // Live devices: use persisted data when ALL live solar devices have a fresh sync.
  // Simulated devices: always call the adapter (no cron sync runs for simulated).
  // Mixed fleets: persist-read for live devices + adapter call for simulated devices,
  //               then sum both contributions.
  const liveSolarDevices = solarDevices.filter((d) => d.provider_type !== 'simulated');
  const simSolarDevices = solarDevices.filter((d) => d.provider_type === 'simulated');
  const liveSolarDeviceIds = liveSolarDevices.map((d) => d.id);
  const solarSyncFresh = liveSolarDeviceIds.length > 0 &&
    liveSolarDeviceIds.every((id) => syncInfoMap.get(id)?.isFresh);

  // Always call adapters for simulated solar; conditionally for live solar.
  const [persistedSolarKw, liveSolarStatuses, simSolarStatuses] = await Promise.all([
    solarSyncFresh
      ? readPersistedSolarKw(liveSolarDeviceIds, providerByDeviceId)
      : Promise.resolve(null),
    solarSyncFresh
      ? Promise.resolve([] as Awaited<ReturnType<ReturnType<typeof createAdapter>['getStatus']>>[])
      : Promise.all(liveSolarDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
    Promise.all(simSolarDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
  ]);

  // Combine: live solar from persisted (or live adapter fallback) + simulated adapter.
  const solarStatuses = [...liveSolarStatuses, ...simSolarStatuses];

  // EV: prefer ev_charge_sessions latest row per device; fall back to adapter.
  const evStatuses = await Promise.all(
    evDevices.map(async (d) => {
      const syncInfo = syncInfoMap.get(d.id);
      if (syncInfo?.isFresh && d.provider_type !== 'simulated') {
        const persisted = await readPersistedEvState(d.id, d.provider_type as ProviderType);
        if (persisted) {
          return {
            isLive: true,
            deviceId: d.id,
            providerType: d.provider_type as ProviderType,
            timestamp: syncInfo.lastSuccessAt ?? new Date(),
            evSOCPercent: persisted.soc_percent ?? undefined,
            evChargeRateKw: persisted.energy_kwh_from_grid,
            evPluggedIn: persisted.plugged_in,
          };
        }
      }
      return createAdapter(d, adapterCtx).getStatus();
    })
  );

  // Battery: SoC comes from persisted battery_state (low-latency, avoids provider quota);
  // batteryPowerKw still comes from a live adapter call because battery_state only stores
  // SoC columns — there is no persisted power_kw value to read.
  // Pattern: parallel (persisted SoC read + live adapter call); merge results.
  const batteryStatuses = await Promise.all(
    batteryDevices.map(async (d) => {
      const syncInfo = syncInfoMap.get(d.id);
      if (syncInfo?.isFresh && d.provider_type !== 'simulated') {
        const [persisted, liveStatus] = await Promise.all([
          readPersistedBatteryState(d.id, d.provider_type as ProviderType),
          createAdapter(d, adapterCtx).getStatus(),
        ]);
        if (persisted) {
          return {
            ...liveStatus,
            batterySOCPercent: persisted.soc_percent,
            batterySOCKwh: persisted.soc_kwh,
            // batteryPowerKw comes from liveStatus (spread above) — not overridden.
          };
        }
        return liveStatus;
      }
      return createAdapter(d, adapterCtx).getStatus();
    })
  );

  // House: prefer house_load latest row; fall back to adapter.
  let houseStatus: Awaited<ReturnType<ReturnType<typeof createAdapter>['getStatus']>> | null = null;
  if (houseDevice) {
    const syncInfo = syncInfoMap.get(houseDevice.id);
    if (syncInfo?.isFresh && houseDevice.provider_type !== 'simulated') {
      const persistedKw = await readPersistedHouseKw(context.user.id, houseDevice.provider_type as ProviderType);
      if (persistedKw != null) {
        houseStatus = {
          isLive: true,
          deviceId: houseDevice.id,
          providerType: houseDevice.provider_type as ProviderType,
          timestamp: syncInfo.lastSuccessAt ?? new Date(),
          houseLoadKw: persistedKw,
        };
      }
    }
    if (!houseStatus) {
      houseStatus = await createAdapter(houseDevice, adapterCtx).getStatus();
    }
  }

  // Grid: prefer persisted energy_flows current-hour row; fall back to live adapter.
  // ingestGridStatus() writes the current-period row each cron cycle, so when the
  // sync is fresh we can reconstruct gridImportKw from the latest persisted edge
  // without making a live provider API call.
  let gridStatus: Awaited<ReturnType<ReturnType<typeof createAdapter>['getStatus']>> | null = null;
  if (gridDevice) {
    const syncInfo = syncInfoMap.get(gridDevice.id);
    if (syncInfo?.isFresh && gridDevice.provider_type !== 'simulated') {
      const persistedGrid = await readPersistedGridKw(
        gridDevice.id, gridDevice.provider_type as ProviderType
      );
      if (persistedGrid != null) {
        gridStatus = {
          isLive: true,
          deviceId: gridDevice.id,
          providerType: gridDevice.provider_type as ProviderType,
          timestamp: syncInfo.lastSuccessAt ?? new Date(),
          // Positive = import from grid; negative = export to grid.
          gridImportKw: persistedGrid,
        };
      }
    }
    if (!gridStatus) {
      gridStatus = await createAdapter(gridDevice, adapterCtx).getStatus();
    }
  }

  // Aggregate solar output:
  //   - Live solar: persisted kW when all live devices are fresh, else adapter statuses.
  //   - Simulated solar: always from adapter (always in solarStatuses / simSolarStatuses).
  //   - Mixed: persisted live kW + simulated adapter kW.
  const simSolarKw = simSolarStatuses.reduce((s, st) => s + (st.solarOutputKw ?? 0), 0);
  const solarOutputKw = persistedSolarKw != null
    ? persistedSolarKw + simSolarKw
    : solarStatuses.reduce((s, st) => s + (st.solarOutputKw ?? 0), 0);

  // House load source preference:
  //   1. Persisted/live house adapter value (real-live OR explicit simulated).
  //   2. Real grid adapter's reported system load.
  //   3. 0 — UI shows an empty state pointing at Settings.
  let houseLoadKw = 0;
  if (houseStatus && houseStatus.houseLoadKw != null) {
    houseLoadKw = houseStatus.houseLoadKw;
  } else if (gridStatus?.houseLoadKwSystem != null) {
    houseLoadKw = gridStatus.houseLoadKwSystem;
  }

  const battery = batteryConfigs[0] ?? null;
  const batteryStatus = batteryStatuses[0];

  // EV states: merge adapter statuses (real or persisted) into a per-vehicle array.
  const evStates = evDevices.map((d, i) => {
    const st = evStatuses[i];
    const cfg = evConfigs.find((c) => c.id === d.id)!;
    const soc = st.evSOCPercent ?? 0;
    const rate = st.evChargeRateKw ?? 0;
    return {
      id: d.id,
      name: findDeviceName(rawDevices, d.id),
      soc_percent: Math.round(soc * 10) / 10,
      charge_rate_kw: Math.round(rate * 100) / 100,
      plugged_in: st.evPluggedIn ?? false,
      range_miles: estimateRangeMiles(soc, cfg.battery_capacity_kwh),
      max_range_miles: estimateRangeMiles(100, cfg.battery_capacity_kwh),
    };
  });

  const evKw = evStates.reduce((s, e) => s + e.charge_rate_kw, 0);
  const batteryPowerKw = batteryStatus?.batteryPowerKw ?? 0;
  const batterySocPercent = batteryStatus?.batterySOCPercent ?? 0;

  const now = new Date();

  const { grid_kw, edges } = allocateFlowEdges(
    {
      solar_kw: solarOutputKw,
      house_kw: houseLoadKw,
      ev_kw: evKw,
      battery_power_kw: batteryPowerKw,
      battery_soc_percent: batterySocPercent,
    },
    now
  );

  const syncInfo: Record<string, { last_success_at: string | null; is_fresh: boolean; consecutive_failures: number }> = {};
  for (const [deviceId, info] of syncInfoMap) {
    syncInfo[deviceId] = {
      last_success_at: info.lastSuccessAt?.toISOString() ?? null,
      is_fresh: info.isFresh,
      consecutive_failures: info.consecutiveFailures,
    };
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    flows: {
      solar_kw: Math.round(solarOutputKw * 100) / 100,
      house_kw: Math.round(houseLoadKw * 100) / 100,
      ev_kw: Math.round(evKw * 100) / 100,
      battery_power_kw: Math.round(batteryPowerKw * 100) / 100,
      battery_soc_percent: Math.round(batterySocPercent * 10) / 10,
      grid_kw: Math.round(grid_kw * 100) / 100,
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        power_kw: Math.round(e.power_kw * 100) / 100,
      })),
    },
    devices: {
      solar: { count: solarConfigs.length, current_kw: Math.round(solarOutputKw * 100) / 100 },
      battery: batteryStatus && battery
        ? {
            id: battery.id,
            name: findDeviceName(rawDevices, battery.id),
            capacity_kwh: batteryStatus.batteryCapacityKwh ?? battery.capacity_kwh,
            soc_percent: Math.round((batteryStatus.batterySOCPercent ?? 0) * 10) / 10,
            soc_kwh: Math.round((batteryStatus.batterySOCKwh ?? 0) * 10) / 10,
            power_kw: Math.round((batteryStatus.batteryPowerKw ?? 0) * 100) / 100,
            max_flow_kw: batteryStatus.batteryMaxFlowKw ?? battery.max_flow_kw,
          }
        : null,
      ev: evStates,
      house: houseDevice || gridStatus?.houseLoadKwSystem != null
        ? { current_kw: Math.round(houseLoadKw * 100) / 100 }
        : null,
      grid: gridDevice ? { current_kw: Math.round((gridStatus?.gridImportKw ?? 0) * 100) / 100 } : null,
    },
    counts: {
      solar: solarConfigs.length,
      battery: batteryConfigs.length,
      ev: evConfigs.length,
    },
    /** Per-device sync health from the background cron. Keyed by device UUID.
     *  is_fresh=true means this device's data may have been served from the
     *  persisted sync tables rather than a live provider API call. */
    sync_info: syncInfo,
  });
}
