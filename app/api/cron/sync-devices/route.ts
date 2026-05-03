/**
 * GET /api/cron/sync-devices
 *
 * Background sync endpoint. Triggered by Vercel Cron (or any external
 * scheduler). For every active non-simulated device it:
 *   1. Checks whether the device is due for a sync (per polling-config.ts).
 *   2. Calls getStatus() on the adapter; ingests normalized rows.
 *   3. Calls getHistory() for the provider's configured window on each
 *      relevant metric; ingests normalized rows into time-series tables.
 *   4. Updates device_sync_state on every attempt (success or failure).
 *   5. Applies per-provider 429 backoff via device_sync_state.rate_limited_until.
 *
 * Security: fails closed when CRON_SECRET is not set.
 *   Header: Authorization: Bearer <CRON_SECRET>
 *   Or query: ?secret=<CRON_SECRET>
 *
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/sync-devices", "schedule": "* * * * *" }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createAdapter } from '@/lib/adapters/factory';
import { decryptConnectionConfig, encryptConnectionConfig } from '@/lib/crypto/connection-config';
import {
  isDueForSync,
  getPollingConfig,
} from '@/lib/server/polling-config';
import {
  updateSyncState,
  ingestBatteryStatus,
  ingestHouseStatus,
  ingestEvStatus,
  ingestSolarStatus,
  ingestGridStatus,
  ingestSolarHistory,
  ingestBatteryHistory,
  ingestGridHistory,
} from '@/lib/server/sync-ingestion';
import type { DeviceRecord, ProviderType } from '@/lib/adapters/types';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/cron/sync-devices' });

const SIMULATED: ProviderType = 'simulated';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reqLog = log.child({ request_id: req.headers.get('x-request-id') ?? undefined });

  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from('devices')
    .select('*')
    .eq('is_active', true)
    .neq('provider_type', SIMULATED);

  if (error) {
    reqLog.error('Failed to load devices', { error: error.message });
    return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 });
  }

  const devices = rows ?? [];
  if (devices.length === 0) {
    reqLog.info('cron sync: no active devices to sync');
    return NextResponse.json({ synced: 0, skipped: 0 });
  }

  reqLog.info('cron sync started', { device_count: devices.length });

  const deviceIds = devices.map((d) => d.id);

  // battery_config, solar_config, and ev_config are separate tables (not
  // JSONB columns on devices), so select('*') on devices does not include
  // them.  Fetch all three config tables in parallel and index by device_id
  // so each device record can be augmented before building the adapter.
  const [batteryConfigRows, solarConfigRows, evConfigRows] = await Promise.all([
    supabase
      .from('battery_config')
      .select('device_id, capacity_kwh, max_flow_kw')
      .in('device_id', deviceIds),
    supabase
      .from('solar_config')
      .select('device_id, panel_count, output_per_panel_kw')
      .in('device_id', deviceIds),
    supabase
      .from('ev_config')
      .select('device_id, battery_capacity_kwh, target_charge, charger_power_kw, departure_time')
      .in('device_id', deviceIds),
  ]);

  const batteryConfigMap = new Map(
    (batteryConfigRows.data ?? []).map((r) => [r.device_id, r])
  );
  const solarConfigMap = new Map(
    (solarConfigRows.data ?? []).map((r) => [r.device_id, r])
  );
  const evConfigMap = new Map(
    (evConfigRows.data ?? []).map((r) => [r.device_id, r])
  );
  const { data: syncStates } = await supabase
    .from('device_sync_state')
    .select('device_id, last_sync_at, consecutive_failures, rate_limited_until')
    .in('device_id', deviceIds);

  const syncStateMap = new Map(
    (syncStates ?? []).map((s) => [
      s.device_id,
      {
        lastSyncAt: s.last_sync_at ? new Date(s.last_sync_at) : null,
        consecutiveFailures: s.consecutive_failures ?? 0,
        rateLimitedUntil: s.rate_limited_until ? new Date(s.rate_limited_until) : null,
      },
    ])
  );

  // Build per-user maps for companion devices (needed when ingesting history
  // that references companion device IDs, e.g. solar → house edge rows).
  const { data: houseDevices } = await supabase
    .from('devices')
    .select('id, user_id')
    .eq('is_active', true)
    .eq('type', 'house');

  const houseByUser = new Map(
    (houseDevices ?? []).map((d) => [d.user_id as string, d.id as string])
  );

  let synced = 0;
  let skipped = 0;

  for (const raw of devices) {
    const providerType: ProviderType = raw.provider_type as ProviderType;
    const syncState = syncStateMap.get(raw.id) ?? {
      lastSyncAt: null,
      consecutiveFailures: 0,
      rateLimitedUntil: null,
    };

    // Respect per-provider 429 backoff — skip if still within backoff window.
    if (syncState.rateLimitedUntil && syncState.rateLimitedUntil > new Date()) {
      console.info(
        `[sync-cron] device ${raw.id} rate-limited until ${syncState.rateLimitedUntil.toISOString()}, skipping`
      );
      skipped++;
      continue;
    }

    if (!isDueForSync(providerType, syncState.lastSyncAt, syncState.consecutiveFailures)) {
      skipped++;
      continue;
    }

    const stored = (raw.connection_config ?? {}) as Record<string, unknown>;
    const decrypted =
      typeof stored.__encrypted === 'string' && stored.__encrypted.length > 0
        ? decryptConnectionConfig(stored)
        : stored;

    // Proactively refresh token if it expires within the next 5 minutes.
    // The adapter's internal refresh-on-401 handles the runtime case; this
    // prevents calls that are certain to fail before even trying.
    const expiresAt = Number(decrypted.expires_at ?? 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (expiresAt > 0 && expiresAt - nowSec < 300) {
      console.info(
        `[sync-cron] device ${raw.id} token expires soon (${expiresAt - nowSec}s), ` +
        `adapter will attempt proactive refresh on first call`
      );
    }

    const device: DeviceRecord = {
      id: raw.id,
      user_id: raw.user_id,
      name: raw.name,
      type: raw.type,
      is_active: raw.is_active,
      provider_type: providerType,
      connection_config: decrypted,
    };

    // Augment the device record with config from the separately-joined tables.
    // raw.solar_config / battery_config / ev_config would always be undefined
    // because those live in separate DB tables, not columns on devices.
    const battCfg = batteryConfigMap.get(raw.id);
    const solarCfg = solarConfigMap.get(raw.id);
    const evCfg = evConfigMap.get(raw.id);

    if (solarCfg) {
      device.solar_config = {
        panel_count: Number(solarCfg.panel_count),
        output_per_panel_kw: Number(solarCfg.output_per_panel_kw),
      };
    }
    if (battCfg) {
      device.battery_config = {
        capacity_kwh: Number(battCfg.capacity_kwh),
        max_flow_kw: Number(battCfg.max_flow_kw),
      };
    }
    if (evCfg) {
      device.ev_config = {
        battery_capacity_kwh: Number(evCfg.battery_capacity_kwh),
        target_charge: Number(evCfg.target_charge),
        charger_power_kw: Number(evCfg.charger_power_kw),
        departure_time: evCfg.departure_time as string,
      };
    }

    const userId = raw.user_id as string;

    const persister = async (plaintext: Record<string, unknown>) => {
      const encrypted = encryptConnectionConfig(plaintext);
      await supabase
        .from('devices')
        .update({ connection_config: encrypted })
        .eq('id', device.id);
    };

    const adapter = createAdapter(device, { persistConfig: (_id, pt) => persister(pt) });
    const pollingCfg = getPollingConfig(providerType);
    const now = new Date();
    const historyStart = new Date(now.getTime() - pollingCfg.historyWindowSec * 1000);

    try {
      const status = await adapter.getStatus();

      if (!status.isLive) {
        // Check for 429 signal in the error message to apply backoff.
        const is429 = status.error?.includes('429') || status.error?.toLowerCase().includes('rate limit');
        if (is429) {
          const backoffUntil = new Date(Date.now() + pollingCfg.backoffOnRateLimitSec * 1000);
          reqLog.warn('device rate-limited (429) on status, backing off', { device_id: raw.id, backoff_until: backoffUntil.toISOString() });
          await updateSyncState(device.id, userId, false, status.error ?? 'Rate limited', backoffUntil);
        } else {
          await updateSyncState(device.id, userId, false, status.error ?? 'Provider returned isLive:false');
        }
        continue;
      }

      // --- Status ingestion by device type ---
      // Each ingestor returns true on success / no-op, false on write error.
      // A write failure is treated as a sync failure so that device_sync_state
      // reflects real persisted data health rather than just adapter-call success.
      let statusIngestOk = true;
      switch (device.type) {
        case 'battery':
          statusIngestOk = await ingestBatteryStatus(device, status);
          break;
        case 'house':
          statusIngestOk = await ingestHouseStatus(device, status, userId);
          break;
        case 'ev':
          statusIngestOk = await ingestEvStatus(device, status, userId);
          break;
        case 'solar_array':
          statusIngestOk = await ingestSolarStatus(
            device, status, userId, houseByUser.get(userId) ?? null
          );
          break;
        case 'grid':
          statusIngestOk = await ingestGridStatus(device, status, userId);
          break;
      }

      if (!statusIngestOk) {
        await updateSyncState(
          device.id,
          userId,
          false,
          'Status ingestion write failed — persisted data may be stale'
        );
        continue;
      }

      // --- History ingestion by device type ---
      // History failures are logged but non-fatal: the live status was already
      // persisted successfully, so the device is considered synced.
      try {
        if (device.type === 'solar_array') {
          const points = await adapter.getHistory({
            metric: 'energy_kwh',
            startDate: historyStart,
            endDate: now,
          });
          await ingestSolarHistory(device, points, userId, houseByUser.get(userId) ?? null);
        } else if (device.type === 'battery') {
          const [socPoints, powerPoints] = await Promise.all([
            adapter.getHistory({ metric: 'soc_kwh', startDate: historyStart, endDate: now }),
            adapter.getHistory({ metric: 'power_kw', startDate: historyStart, endDate: now }),
          ]);
          await ingestBatteryHistory(device, socPoints, powerPoints, userId);
        } else if (device.type === 'grid') {
          const points = await adapter.getHistory({
            metric: 'energy_kwh',
            startDate: historyStart,
            endDate: now,
          });
          await ingestGridHistory(device, points, userId);
        } else if (device.type === 'ev') {
          const points = await adapter.getHistory({
            metric: 'charge_kw',
            startDate: historyStart,
            endDate: now,
          });
          await ingestEvHistory(device, points, userId);
        } else if (device.type === 'house') {
          const points = await adapter.getHistory({
            metric: 'energy_kwh',
            startDate: historyStart,
            endDate: now,
          });
          await ingestHouseHistory(device, points, userId);
        }
      } catch (histErr) {
        const msg = histErr instanceof Error ? histErr.message : 'unknown';
        // Check for 429 in history fetch too.
        if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
          const backoffUntil = new Date(Date.now() + pollingCfg.backoffOnRateLimitSec * 1000);
          reqLog.warn('device history fetch rate-limited, backing off', { device_id: raw.id, backoff_until: backoffUntil.toISOString() });
          await updateSyncState(device.id, userId, false, `History fetch rate-limited: ${msg}`, backoffUntil);
          continue;
        }
        reqLog.warn('history fetch failed for device', { device_id: device.id, error: msg });
        // History failures are non-fatal — status ingest succeeded.
      }

      await updateSyncState(device.id, userId, true);
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit');
      if (is429) {
        const backoffUntil = new Date(Date.now() + pollingCfg.backoffOnRateLimitSec * 1000);
        reqLog.warn('device rate-limited (429), backing off', { device_id: raw.id });
        await updateSyncState(device.id, userId, false, msg, backoffUntil);
      } else {
        reqLog.error('device sync failed', { device_id: device.id, error: msg });
        await updateSyncState(device.id, userId, false, msg);
      }
    }
  }

  return NextResponse.json({ synced, skipped, total: devices.length });
}

// Re-exported wrappers for EV and house history that mirror the solar/battery
// pattern but write into the same tables as the status ingestor.
/**
 * Aggregate sub-hourly charge_kw history points into one row per UTC hour.
 *
 * Provider adapters expose `charge_kw` as an **instantaneous rate** (kW).
 * To convert N sub-hourly rate samples within one UTC hour into a single
 * energy figure (kWh) we use the trapezoidal approximation:
 *   energy_kwh ≈ average(kW samples) × 1 hour
 * This avoids the over-count that summing raw kW samples would produce
 * (e.g. 12 five-minute samples at 7.2 kW would incorrectly sum to 86.4 kWh
 * instead of 7.2 kWh). One row per device/hour/resolution is inserted.
 */
async function ingestEvHistory(
  device: DeviceRecord,
  points: import('@/lib/adapters/types').HistoricalPoint[],
  userId: string
): Promise<void> {
  if (points.length === 0) return;
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // Bucket sub-hourly kW samples: track sum and count per UTC-hour key.
  const byHour = new Map<string, { sum: number; count: number }>();
  for (const p of points) {
    // Validate: charge rate must be non-negative and plausible (cap at 350 kW — DC fast charge).
    if (!isFinite(p.value) || p.value < 0 || p.value > 350) {
      log.warn('ingestEvHistory: charge_kw outside [0,350], skipping', { device_id: device.id, value: p.value });
      continue;
    }
    const ts = new Date(p.timestamp);
    ts.setMinutes(0, 0, 0);
    const key = ts.toISOString();
    const prev = byHour.get(key) ?? { sum: 0, count: 0 };
    byHour.set(key, { sum: prev.sum + p.value, count: prev.count + 1 });
  }
  // Convert average kW → kWh (average rate × 1 hour).
  const byHourKwh = new Map<string, number>(
    [...byHour.entries()].map(([key, { sum, count }]) => [key, sum / count])
  );

  if (byHourKwh.size === 0) return;

  // Delete existing rows for the same device/hour/resolution before inserting
  // so repeated cron runs are idempotent.
  for (const ts of byHourKwh.keys()) {
    await supabase
      .from('ev_charge_sessions')
      .delete()
      .eq('device_id', device.id)
      .eq('timestamp', ts)
      .eq('resolution', '1hr');
  }

  const rows = [...byHourKwh.entries()].map(([ts, energyKwh]) => ({
    user_id: userId,
    device_id: device.id,
    soc_percent: null as number | null,
    plugged_in: true,
    energy_kwh_from_solar: 0,
    energy_kwh_from_grid: energyKwh,
    energy_kwh_from_battery: 0,
    timestamp: ts,
    resolution: '1hr' as const,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('ev_charge_sessions').insert(rows);
  if (error) log.warn('ev_charge_sessions insert error', { device_id: device.id, error: error.message });
}

/**
 * Aggregate sub-hourly energy_kwh history points into one row per UTC hour
 * for the house_load table. Additive energy values are summed per hour so
 * that repeated cron runs and sub-hourly provider intervals both produce
 * exactly one row per device/hour/resolution bucket.
 */
async function ingestHouseHistory(
  device: DeviceRecord,
  points: import('@/lib/adapters/types').HistoricalPoint[],
  userId: string
): Promise<void> {
  if (points.length === 0) return;
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // Aggregate to one row per UTC hour.
  const byHour = new Map<string, number>();
  for (const p of points) {
    // Validate: house energy must be non-negative and plausible (cap at 500 kWh/hr).
    if (!isFinite(p.value) || p.value < 0 || p.value > 500) {
      log.warn('ingestHouseHistory: energy_kwh outside [0,500], skipping', { device_id: device.id, value: p.value });
      continue;
    }
    const ts = new Date(p.timestamp);
    ts.setMinutes(0, 0, 0);
    const key = ts.toISOString();
    byHour.set(key, (byHour.get(key) ?? 0) + p.value);
  }

  if (byHour.size === 0) return;

  for (const ts of byHour.keys()) {
    await supabase
      .from('house_load')
      .delete()
      .eq('user_id', userId)
      .eq('timestamp', ts)
      .eq('resolution', '1hr');
  }

  const rows = [...byHour.entries()].map(([ts, energyKwh]) => ({
    user_id: userId,
    timestamp: ts,
    resolution: '1hr' as const,
    energy_kwh: energyKwh,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('house_load').insert(rows);
  if (error) log.warn('house_load insert error', { device_id: device.id, error: error.message });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: endpoint MUST be protected in production.
    // Set CRON_SECRET to a secure random string (32+ chars) before deploying.
    log.error('CRON_SECRET is not configured — rejecting all requests');
    return false;
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = req.nextUrl.searchParams.get('secret');
  if (querySecret === secret) return true;

  return false;
}
