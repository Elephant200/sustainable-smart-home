/**
 * Server-only helper that loads the authenticated user's devices + configs
 * from Supabase and returns them in a shape the simulation library understands.
 *
 * Used by every /api/* route that drives the dashboard.
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { SolarArrayConfig } from '@/lib/simulation/solar';
import type { BatteryDeviceConfig } from '@/lib/simulation/battery';
import type { EvDeviceConfig } from '@/lib/simulation/ev';
import type { DeviceRecord } from '@/lib/adapters/types';
import {
  decryptConnectionConfig,
  encryptConnectionConfig,
} from '@/lib/crypto/connection-config';

export interface UserDeviceContext {
  user: User;
  supabase: SupabaseClient;
  rawDevices: DeviceRecord[];
  solarConfigs: SolarArrayConfig[];
  batteryConfigs: BatteryDeviceConfig[];
  evConfigs: EvDeviceConfig[];
  hasHouse: boolean;
  hasGrid: boolean;
  /**
   * Encrypts the given plaintext connection_config and writes it back to
   * `devices.connection_config`. Used by OAuth-based adapters (Tesla,
   * Enphase) and Cognito-based adapters (Emporia) to persist rotated
   * tokens so the next request doesn't re-authenticate from scratch.
   *
   * Routes pass this as `persistConfig` on the adapter context.
   */
  persistConnectionConfig: (
    deviceId: string,
    plaintext: Record<string, unknown>
  ) => Promise<void>;
}

/**
 * Returns either { context } or { error } — never both.
 * Routes pass the error directly to NextResponse.json with the matching status.
 */
export async function loadUserContext(): Promise<
  | { context: UserDeviceContext; error?: undefined }
  | { context?: undefined; error: { status: number; body: { error: string } } }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: { status: 401, body: { error: 'Unauthorized' } } };
  }

  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (devicesError) {
    return {
      error: {
        status: 500,
        body: { error: 'Failed to load devices' },
      },
    };
  }

  const deviceList = devices ?? [];

  const solarIds = deviceList.filter((d) => d.type === 'solar_array').map((d) => d.id);
  const batteryIds = deviceList.filter((d) => d.type === 'battery').map((d) => d.id);
  const evIds = deviceList.filter((d) => d.type === 'ev').map((d) => d.id);

  const [solarRows, batteryRows, evRows] = await Promise.all([
    solarIds.length
      ? supabase
          .from('solar_config')
          .select('device_id, panel_count, output_per_panel_kw')
          .in('device_id', solarIds)
      : Promise.resolve({ data: [], error: null }),
    batteryIds.length
      ? supabase
          .from('battery_config')
          .select('device_id, capacity_kwh, max_flow_kw')
          .in('device_id', batteryIds)
      : Promise.resolve({ data: [], error: null }),
    evIds.length
      ? supabase
          .from('ev_config')
          .select(
            'device_id, battery_capacity_kwh, target_charge, departure_time, charger_power_kw'
          )
          .in('device_id', evIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (solarRows.error || batteryRows.error || evRows.error) {
    return {
      error: {
        status: 500,
        body: { error: 'Failed to load device configuration' },
      },
    };
  }

  const solarConfigs: SolarArrayConfig[] = (solarRows.data ?? []).map(
    (r: {
      device_id: string;
      panel_count: number;
      output_per_panel_kw: number;
    }) => ({
      id: r.device_id,
      panel_count: Number(r.panel_count),
      output_per_panel_kw: Number(r.output_per_panel_kw),
    })
  );

  const batteryConfigs: BatteryDeviceConfig[] = (batteryRows.data ?? []).map(
    (r: { device_id: string; capacity_kwh: number; max_flow_kw: number }) => ({
      id: r.device_id,
      capacity_kwh: Number(r.capacity_kwh),
      max_flow_kw: Number(r.max_flow_kw),
    })
  );

  const evConfigs: EvDeviceConfig[] = (evRows.data ?? []).map(
    (r: {
      device_id: string;
      battery_capacity_kwh: number;
      target_charge: number;
      departure_time: string;
      charger_power_kw: number;
    }) => ({
      id: r.device_id,
      battery_capacity_kwh: Number(r.battery_capacity_kwh),
      // The configuration UI captures target charge as a percent (e.g. 80)
      // and stores it as-is, but the EV physics model treats target_charge
      // as a 0..1 fraction. Normalize at this boundary so anything > 1 is
      // treated as a percent. This keeps both legacy rows (fractional) and
      // new rows (percent) working without a migration.
      target_charge: normalizeTargetCharge(Number(r.target_charge)),
      departure_time: r.departure_time,
      charger_power_kw: Number(r.charger_power_kw),
    })
  );

  // Attach the joined config to each device record for adapter use.
  // The DB stores `connection_config` as the encrypted blob
  // `{ __encrypted: "iv:tag:ciphertext" }`. Adapters need the plaintext
  // credentials to call provider APIs, so decrypt at this boundary.
  // Decryption happens server-side only; the plaintext never leaves this
  // module's call graph (routes only return shaped status / history).
  const rawDevices: DeviceRecord[] = deviceList.map((d) => {
    const stored = (d.connection_config ?? {}) as Record<string, unknown>;
    const decrypted =
      typeof stored.__encrypted === 'string' && stored.__encrypted.length > 0
        ? decryptConnectionConfig(stored)
        : stored;
    const dev: DeviceRecord = {
      id: d.id,
      user_id: d.user_id,
      name: d.name,
      type: d.type,
      is_active: d.is_active,
      provider_type: d.provider_type ?? 'simulated',
      connection_config: decrypted,
    };
    if (d.type === 'solar_array') {
      const cfg = solarConfigs.find((c) => c.id === d.id);
      if (cfg)
        dev.solar_config = {
          panel_count: cfg.panel_count,
          output_per_panel_kw: cfg.output_per_panel_kw,
        };
    } else if (d.type === 'battery') {
      const cfg = batteryConfigs.find((c) => c.id === d.id);
      if (cfg)
        dev.battery_config = {
          capacity_kwh: cfg.capacity_kwh,
          max_flow_kw: cfg.max_flow_kw,
        };
    } else if (d.type === 'ev') {
      const cfg = evConfigs.find((c) => c.id === d.id);
      if (cfg)
        dev.ev_config = {
          battery_capacity_kwh: cfg.battery_capacity_kwh,
          target_charge: cfg.target_charge,
          departure_time: cfg.departure_time,
          charger_power_kw: cfg.charger_power_kw,
        };
    }
    return dev;
  });

  const persistConnectionConfig = async (
    deviceId: string,
    plaintext: Record<string, unknown>
  ): Promise<void> => {
    const encrypted = encryptConnectionConfig(plaintext);
    const { error } = await supabase
      .from('devices')
      .update({ connection_config: encrypted })
      .eq('id', deviceId)
      .eq('user_id', user.id);
    if (error) {
      console.error(
        `[device-context] Failed to persist rotated credentials for device ${deviceId}:`,
        error
      );
    }
  };

  return {
    context: {
      user,
      supabase,
      rawDevices,
      solarConfigs,
      batteryConfigs,
      evConfigs,
      hasHouse: deviceList.some((d) => d.type === 'house'),
      hasGrid: deviceList.some((d) => d.type === 'grid'),
      persistConnectionConfig,
    },
  };
}

/** Coerce a target-charge value into a 0..1 fraction, regardless of whether
 *  it was stored as a fraction (legacy) or a percent (current UI). Values
 *  outside [0, 1] (after normalization) are clamped to a sensible default. */
function normalizeTargetCharge(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0.8;
  // Treat anything > 1 as a percent (e.g. 80 → 0.8). Anything in (0, 1] is
  // already a fraction.
  const fraction = value > 1 ? value / 100 : value;
  // Clamp to a safe range so a malformed entry can never blow up the model.
  return Math.min(1, Math.max(0.1, fraction));
}

export function findDeviceName(
  devices: DeviceRecord[],
  id: string
): string {
  return devices.find((d) => d.id === id)?.name ?? id;
}
