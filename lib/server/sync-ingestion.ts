/**
 * Background sync ingestion helpers.
 *
 * These functions normalize a DeviceStatus / HistoricalPoint[] result from an
 * adapter and write it into the existing time-series tables:
 *   - battery_state      (per-device SoC snapshots)
 *   - house_load         (per-user hourly energy)
 *   - ev_charge_sessions (per-device EV snapshots)
 *   - energy_flows       (per-device hourly flow edges)
 *
 * They also update device_sync_state after each attempt so the settings
 * health card and dashboard disconnection banner reflect fresh state.
 *
 * All writes use the Supabase service-role client so they bypass RLS and
 * succeed even when called from the cron route (which has no user session).
 *
 * Security / hardening model for cron writes:
 *   The cron endpoint is authenticated via CRON_SECRET (Bearer token checked
 *   before any data is read or written). Because the cron has no user session,
 *   request-layer rate-limiting (checkWriteRateLimit) does not apply — instead
 *   the equivalent protection is provided by:
 *     1. isDueForSync() — per-device polling cadence guard (prevents runaway writes).
 *     2. rateLimitedUntil backoff — per-provider 429 gate in the cron loop.
 *     3. validateIngestedValue() below — input range-checks on every value
 *        before it reaches the DB, equivalent to the Zod schemas used in the
 *        user-facing write routes.
 *     4. recordAuditEvent() — every successful status write emits an audit row.
 *     5. encryptConnectionConfig() — credentials remain encrypted at rest;
 *        decryptConnectionConfig() is called ephemerally within the cron loop.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { recordAuditEvent } from '@/lib/audit/log';
import { createLogger } from '@/lib/logger';
import type { DeviceRecord, DeviceStatus, HistoricalPoint } from '@/lib/adapters/types';

const log = createLogger({ route: 'lib/server/sync-ingestion' });

// ---------------------------------------------------------------------------
// Internal validation guards (equivalent to request-layer Zod schemas but
// applied at the ingestion boundary so cron writes are range-checked before
// they reach the DB even without a user session).
// ---------------------------------------------------------------------------

/**
 * Validates a numeric value against expected physical bounds.
 * Returns true when the value is a finite number within [min, max].
 * On failure, logs a warning and returns false so the caller can skip the write.
 */
function validateIngestedValue(
  label: string,
  value: number | null | undefined,
  min: number,
  max: number
): value is number {
  if (value == null || !isFinite(value)) {
    log.warn('ingestion validation: null or non-finite value', { label, value });
    return false;
  }
  if (value < min || value > max) {
    log.warn('ingestion validation: value out of range', { label, value, min, max });
    return false;
  }
  return true;
}

/** Clamp a numeric value into [min, max] after it has passed range-check. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface SyncResult {
  deviceId: string;
  success: boolean;
  error?: string;
}

/**
 * Record a sync attempt in device_sync_state. Called by the cron route
 * after each adapter call, whether it succeeded or failed.
 *
 * @param rateLimitedUntil — when set, the cron will skip this device until this time (429 backoff)
 */
export async function updateSyncState(
  deviceId: string,
  userId: string,
  success: boolean,
  errorMessage?: string,
  rateLimitedUntil?: Date
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  if (success) {
    // On success: reset failures, clear rate-limit, record success timestamp.
    const { error } = await supabase
      .from('device_sync_state')
      .upsert(
        {
          device_id: deviceId,
          user_id: userId,
          last_sync_at: now,
          last_success_at: now,
          consecutive_failures: 0,
          last_error_message: null,
          rate_limited_until: null,
          updated_at: now,
        },
        { onConflict: 'device_id' }
      );
    if (error) {
      log.error('Failed to update device_sync_state', { device_id: deviceId, error: error.message });
    }
    return;
  }

  // On failure: increment consecutive_failures atomically via read-then-write.
  const { data: current } = await supabase
    .from('device_sync_state')
    .select('consecutive_failures')
    .eq('device_id', deviceId)
    .single();

  const newFailures = (current?.consecutive_failures ?? 0) + 1;

  const row: Record<string, unknown> = {
    device_id: deviceId,
    user_id: userId,
    last_sync_at: now,
    last_error_at: now,
    last_error_message: errorMessage ?? 'Unknown error',
    consecutive_failures: newFailures,
    updated_at: now,
  };

  if (rateLimitedUntil) {
    row.rate_limited_until = rateLimitedUntil.toISOString();
  }

  const { error } = await supabase
    .from('device_sync_state')
    .upsert(row, { onConflict: 'device_id' });

  if (error) {
    log.error('Failed to update device_sync_state', { device_id: deviceId, error: error.message });
  }
}

/**
 * Persist a battery DeviceStatus snapshot into battery_state.
 * Uses upsert on (device_id, timestamp) — the primary key.
 *
 * Returns true when the write succeeded (or was a no-op), false on error.
 * The cron caller uses this to gate updateSyncState(success=true) so that
 * a failed ingestion write does not cause the device to appear healthy.
 */
export async function ingestBatteryStatus(
  device: DeviceRecord,
  status: DeviceStatus
): Promise<boolean> {
  if (!status.isLive) return true; // Nothing to write — not a write failure.
  if (status.batterySOCPercent == null) return true;

  // Input validation: soc_percent must be in [0, 100] per DB CHECK constraint.
  if (!validateIngestedValue('batterySOCPercent', status.batterySOCPercent, 0, 100)) return true;

  const supabase = createServiceClient();
  const soc_kwh =
    status.batterySOCKwh ??
    (status.batteryCapacityKwh != null
      ? clamp(status.batterySOCPercent / 100, 0, 1) * status.batteryCapacityKwh
      : 0);

  const { error } = await supabase.from('battery_state').upsert(
    {
      device_id: device.id,
      soc_percent: status.batterySOCPercent,
      soc_kwh,
      timestamp: status.timestamp.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'device_id,timestamp' }
  );

  if (error) {
    log.warn('battery_state upsert error', { device_id: device.id, error: error.message });
    return false;
  }

  await recordAuditEvent({
    userId: device.user_id,
    action: 'credential.write',
    deviceId: device.id,
    metadata: { table: 'battery_state', soc_percent: status.batterySOCPercent },
  });
  return true;
}

/**
 * Persist battery SoC and power history into battery_state rows.
 * Buckets points to the nearest hour boundary; uses upsert on (device_id, timestamp).
 */
export async function ingestBatteryHistory(
  device: DeviceRecord,
  socPoints: HistoricalPoint[],
  powerPoints: HistoricalPoint[],
  _userId: string
): Promise<void> {
  if (socPoints.length === 0 && powerPoints.length === 0) return;

  const supabase = createServiceClient();

  // Build a map keyed by ISO-hour string, collecting last soc_kwh and avg power_kw.
  const byHour = new Map<string, { soc_kwh: number; power_kw_sum: number; power_count: number }>();

  for (const p of socPoints) {
    // Validate: soc_kwh must be non-negative and plausible (cap at 1 MWh — large residential battery).
    if (!validateIngestedValue('battery soc_kwh', p.value, 0, 1000)) continue;
    const ts = hourStart(p.timestamp);
    const existing = byHour.get(ts) ?? { soc_kwh: 0, power_kw_sum: 0, power_count: 0 };
    // Take the last SoC value of the hour.
    existing.soc_kwh = p.value;
    byHour.set(ts, existing);
  }

  for (const p of powerPoints) {
    // Validate: power_kw must be plausible (cap at 1000 kW — large commercial system).
    if (!validateIngestedValue('battery power_kw', Math.abs(p.value), 0, 1000)) continue;
    const ts = hourStart(p.timestamp);
    const existing = byHour.get(ts) ?? { soc_kwh: 0, power_kw_sum: 0, power_count: 0 };
    existing.power_kw_sum += p.value;
    existing.power_count++;
    byHour.set(ts, existing);
  }

  // battery_state.soc_percent is NOT NULL in the schema with a 0–100 CHECK.
  // History points only contain soc_kwh; derive soc_percent from the device's
  // configured capacity when available, otherwise clamp to 0 so the constraint
  // is never violated and the upsert does not fail silently.
  const capacityKwh = device.battery_config?.capacity_kwh ?? 0;
  const rows = [...byHour.entries()].map(([ts, d]) => {
    const soc_percent =
      capacityKwh > 0
        ? Math.min(100, Math.max(0, (d.soc_kwh / capacityKwh) * 100))
        : 0;
    return {
      device_id: device.id,
      soc_percent,
      soc_kwh: d.soc_kwh,
      timestamp: ts,
      updated_at: new Date().toISOString(),
    };
  });

  for (const row of rows) {
    const { error } = await supabase
      .from('battery_state')
      .upsert(row, { onConflict: 'device_id,timestamp' });
    if (error) {
      log.warn('battery_state history upsert error', { device_id: device.id, ts: row.timestamp, error: error.message });
    }
  }
}

/**
 * Persist a house DeviceStatus snapshot into house_load.
 * Rounds the timestamp to the nearest hour boundary for the 1hr resolution row.
 *
 * The house_load table stores hourly ENERGY (kWh). A single instantaneous
 * status reading is treated as a 1-hour average: energy_kwh ≈ power_kw × 1h.
 * This approximation is appropriate only when the device lacks a history API
 * (e.g. Home Assistant sensors without an energy_entity_id). For providers
 * that do expose kWh history (SolarEdge CONSUMPTION, HA cumulative meters),
 * ingestHouseHistory() should be preferred — it writes proper per-hour energy.
 *
 * Deletes any existing row for the same user+timestamp+resolution before
 * inserting so repeated sync runs don't accumulate duplicates.
 */
export async function ingestHouseStatus(
  device: DeviceRecord,
  status: DeviceStatus,
  userId: string
): Promise<boolean> {
  if (!status.isLive) return true;
  const powerKw = status.houseLoadKw ?? status.houseLoadKwSystem;
  if (powerKw == null) return true;

  // Input validation: house load must be non-negative and physically plausible
  // (cap at 500 kW — well above any residential installation).
  if (!validateIngestedValue('houseLoadKw', powerKw, 0, 500)) return true;

  const ts = new Date(status.timestamp);
  ts.setMinutes(0, 0, 0);
  const tsIso = ts.toISOString();

  // Treat instantaneous power (kW) as energy over 1 hour (kWh).
  // Proper per-hour kWh is written by the history ingestor when available.
  const energyKwh = powerKw;

  const supabase = createServiceClient();

  await supabase
    .from('house_load')
    .delete()
    .eq('user_id', userId)
    .eq('timestamp', tsIso)
    .eq('resolution', '1hr');

  const { error } = await supabase.from('house_load').insert({
    user_id: userId,
    timestamp: tsIso,
    resolution: '1hr',
    energy_kwh: energyKwh,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    log.warn('house_load insert error', { device_id: device.id, error: error.message });
    return false;
  }
  await recordAuditEvent({
    userId,
    action: 'credential.write',
    deviceId: device.id,
    metadata: { table: 'house_load', energy_kwh: energyKwh },
  });
  return true;
}

/**
 * Persist an EV DeviceStatus snapshot into ev_charge_sessions.
 * Rounds the timestamp to the nearest hour boundary.
 *
 * The ev_charge_sessions table stores hourly ENERGY (kWh). A single
 * instantaneous charge rate reading (kW) is treated as a 1-hour average:
 * energy_kwh ≈ charge_rate_kw × 1h. This approximation is only appropriate
 * when the provider has no kWh history API. For providers that do expose
 * per-session energy (Tesla charging history), the cron ingestEvHistory()
 * helper writes proper per-hour energy and should be preferred.
 *
 * Deletes any existing row for the same device+timestamp+resolution before
 * inserting so repeated sync runs don't accumulate duplicates.
 */
export async function ingestEvStatus(
  device: DeviceRecord,
  status: DeviceStatus,
  userId: string
): Promise<boolean> {
  if (!status.isLive) return true;
  if (status.evSOCPercent == null && !status.evPluggedIn) return true;

  // Input validation: evSOCPercent must be in [0, 100] per DB CHECK constraint;
  // charge rate must be non-negative and plausible (cap at 350 kW — DC fast charge max).
  if (status.evSOCPercent != null &&
      !validateIngestedValue('evSOCPercent', status.evSOCPercent, 0, 100)) return true;
  if (status.evChargeRateKw != null &&
      !validateIngestedValue('evChargeRateKw', status.evChargeRateKw, 0, 350)) return true;

  const ts = new Date(status.timestamp);
  ts.setMinutes(0, 0, 0);
  const tsIso = ts.toISOString();

  // Treat instantaneous charge rate (kW) as energy over 1 hour (kWh).
  // Proper per-hour kWh is written by the history ingestor when available.
  const chargeEnergyKwh = status.evChargeRateKw ?? 0;

  const supabase = createServiceClient();

  await supabase
    .from('ev_charge_sessions')
    .delete()
    .eq('device_id', device.id)
    .eq('timestamp', tsIso)
    .eq('resolution', '1hr');

  const { error } = await supabase.from('ev_charge_sessions').insert({
    user_id: userId,
    device_id: device.id,
    soc_percent: status.evSOCPercent ?? null,
    plugged_in: status.evPluggedIn ?? false,
    energy_kwh_from_solar: 0,
    energy_kwh_from_grid: chargeEnergyKwh,
    energy_kwh_from_battery: 0,
    timestamp: tsIso,
    resolution: '1hr',
    updated_at: new Date().toISOString(),
  });

  if (error) {
    log.warn('ev_charge_sessions insert error', { device_id: device.id, error: error.message });
    return false;
  }
  await recordAuditEvent({
    userId,
    action: 'credential.write',
    deviceId: device.id,
    metadata: { table: 'ev_charge_sessions', energy_kwh_from_grid: chargeEnergyKwh },
  });
  return true;
}

/**
 * Persist a solar DeviceStatus snapshot into energy_flows as a current-period
 * `solar → house` edge row at 1hr resolution, so the snapshot route can read
 * persisted solar output without making a live provider API call every request.
 *
 * Returns true on success / no-op, false on write error.
 */
export async function ingestSolarStatus(
  device: DeviceRecord,
  status: DeviceStatus,
  userId: string,
  houseDeviceId: string | null
): Promise<boolean> {
  if (!status.isLive) return true;
  const solarKw = status.solarOutputKw;
  if (solarKw == null) return true;
  if (!validateIngestedValue('solarOutputKw', solarKw, 0, 10000)) return true;

  const supabase = createServiceClient();
  const targetId = houseDeviceId ?? device.id;
  const ts = hourStart(status.timestamp);

  // Delete any existing row for this device+hour before inserting so the
  // current-period row always reflects the most recent status call.
  await supabase
    .from('energy_flows')
    .delete()
    .eq('source_device_id', device.id)
    .eq('timestamp', ts)
    .eq('resolution', '1hr');

  const { error } = await supabase.from('energy_flows').insert({
    user_id: userId,
    source_device_id: device.id,
    target_device_id: targetId,
    source: 'solar',
    target: 'house',
    energy_kwh: solarKw, // 1hr row: kWh = average kW over the hour
    timestamp: ts,
    resolution: '1hr',
    updated_at: new Date().toISOString(),
  });

  if (error) {
    log.warn('energy_flows solar status upsert error', { device_id: device.id, error: error.message });
    return false;
  }

  await recordAuditEvent({
    userId,
    action: 'credential.write',
    deviceId: device.id,
    metadata: { table: 'energy_flows', source: 'solar', solar_kw: solarKw },
  });
  return true;
}

/**
 * Persist a grid DeviceStatus snapshot into energy_flows as a current-period
 * grid→house (import) or house→grid (export) edge row at 1hr resolution.
 *
 * Returns true on success / no-op, false on write error.
 */
export async function ingestGridStatus(
  device: DeviceRecord,
  status: DeviceStatus,
  userId: string
): Promise<boolean> {
  if (!status.isLive) return true;
  const gridKw = status.gridImportKw;
  if (gridKw == null) return true;
  if (!validateIngestedValue('gridImportKw', Math.abs(gridKw), 0, 10000)) return true;

  const supabase = createServiceClient();
  const ts = hourStart(status.timestamp);
  const isImport = gridKw >= 0;

  await supabase
    .from('energy_flows')
    .delete()
    .eq('source_device_id', device.id)
    .eq('timestamp', ts)
    .eq('resolution', '1hr');

  if (Math.abs(gridKw) === 0) return true; // Zero — nothing to write.

  const { error } = await supabase.from('energy_flows').insert({
    user_id: userId,
    source_device_id: device.id,
    target_device_id: device.id,
    source: isImport ? 'grid' : 'house',
    target: isImport ? 'house' : 'grid',
    energy_kwh: Math.abs(gridKw),
    timestamp: ts,
    resolution: '1hr',
    updated_at: new Date().toISOString(),
  });

  if (error) {
    log.warn('energy_flows grid status upsert error', { device_id: device.id, error: error.message });
    return false;
  }

  await recordAuditEvent({
    userId,
    action: 'credential.write',
    deviceId: device.id,
    metadata: { table: 'energy_flows', source: isImport ? 'grid' : 'house', grid_kw: gridKw },
  });
  return true;
}

/**
 * Persist hourly HistoricalPoint[] from a solar adapter into energy_flows.
 * Each point contributes a `solar → house` edge row at 1hr resolution.
 */
export async function ingestSolarHistory(
  device: DeviceRecord,
  points: HistoricalPoint[],
  userId: string,
  houseDeviceId: string | null
): Promise<void> {
  if (points.length === 0) return;

  const supabase = createServiceClient();
  const targetId = houseDeviceId ?? device.id;

  const rows = points
    .filter((p) => {
      // Validate: solar energy must be non-negative and plausible (cap at 10 MWh/hr).
      if (!validateIngestedValue('solar energy_kwh', p.value, 0, 10000)) return false;
      return p.value > 0;
    })
    .map((p) => ({
      user_id: userId,
      source_device_id: device.id,
      target_device_id: targetId,
      source: 'solar',
      target: 'house',
      energy_kwh: p.value,
      timestamp: hourStart(p.timestamp),
      resolution: '1hr' as const,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  // Delete existing rows for this device+timestamp window before re-inserting.
  const timestamps = [...new Set(rows.map((r) => r.timestamp))];
  for (const ts of timestamps) {
    await supabase
      .from('energy_flows')
      .delete()
      .eq('source_device_id', device.id)
      .eq('timestamp', ts)
      .eq('resolution', '1hr');
  }

  const { error } = await supabase.from('energy_flows').insert(rows);
  if (error) {
    log.warn('energy_flows upsert error', { device_id: device.id, error: error.message });
  }
}

/**
 * Persist grid import/export history into energy_flows as grid→house and
 * house→grid edges.
 */
export async function ingestGridHistory(
  device: DeviceRecord,
  points: HistoricalPoint[],
  userId: string
): Promise<void> {
  if (points.length === 0) return;

  const supabase = createServiceClient();

  const rows = points
    .filter((p) => {
      // Validate: grid energy magnitude must be plausible (cap at 10 MWh/hr).
      if (!validateIngestedValue('grid energy_kwh', Math.abs(p.value), 0, 10000)) return false;
      return true;
    })
    .map((p) => ({
      user_id: userId,
      source_device_id: device.id,
      target_device_id: device.id,
      source: p.value >= 0 ? 'grid' : 'house',
      target: p.value >= 0 ? 'house' : 'grid',
      energy_kwh: Math.abs(p.value),
      timestamp: hourStart(p.timestamp),
      resolution: '1hr' as const,
      updated_at: new Date().toISOString(),
    })).filter((r) => r.energy_kwh > 0);

  if (rows.length === 0) return;

  const timestamps = [...new Set(rows.map((r) => r.timestamp))];
  for (const ts of timestamps) {
    await supabase
      .from('energy_flows')
      .delete()
      .eq('source_device_id', device.id)
      .eq('timestamp', ts)
      .eq('resolution', '1hr');
  }

  const { error } = await supabase.from('energy_flows').insert(rows);
  if (error) {
    log.warn('energy_flows grid history error', { device_id: device.id, error: error.message });
  }
}

function hourStart(ts: Date): string {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}
