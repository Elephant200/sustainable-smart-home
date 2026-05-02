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

export interface UserDeviceContext {
  user: User;
  supabase: SupabaseClient;
  rawDevices: DeviceRecord[];
  solarConfigs: SolarArrayConfig[];
  batteryConfigs: BatteryDeviceConfig[];
  evConfigs: EvDeviceConfig[];
  hasHouse: boolean;
  hasGrid: boolean;
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
      target_charge: Number(r.target_charge),
      departure_time: r.departure_time,
      charger_power_kw: Number(r.charger_power_kw),
    })
  );

  // Attach the joined config to each device record for adapter use
  const rawDevices: DeviceRecord[] = deviceList.map((d) => {
    const dev: DeviceRecord = {
      id: d.id,
      user_id: d.user_id,
      name: d.name,
      type: d.type,
      is_active: d.is_active,
      provider_type: d.provider_type ?? 'simulated',
      connection_config: d.connection_config ?? {},
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
    },
  };
}

export function findDeviceName(
  devices: DeviceRecord[],
  id: string
): string {
  return devices.find((d) => d.id === id)?.name ?? id;
}
