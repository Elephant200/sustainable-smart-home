/**
 * Helpers that resolve the user's house / grid device records.
 *
 * Per product rule, the simulator is only used when the user has
 * **explicitly** added a device with `provider_type === 'simulated'`. There is
 * therefore no synthetic fallback when the user hasn't configured a real
 * house or grid device — the picker returns `null` and the calling route is
 * responsible for surfacing an empty-state UI that points the user at
 * Settings to add one.
 */

import type { DeviceRecord } from '@/lib/adapters/types';

/**
 * Returns the user's configured house device when present, otherwise `null`.
 * Routes that need a house reading should branch on `null` and skip the
 * adapter call (and surface an "add a house meter in Settings" empty state).
 */
export function pickHouseDevice(devices: DeviceRecord[]): DeviceRecord | null {
  return (
    devices.find((d) => d.type === 'house' && d.is_active !== false) ?? null
  );
}

/**
 * Returns the user's configured grid device when present, otherwise `null`.
 */
export function pickGridDevice(devices: DeviceRecord[]): DeviceRecord | null {
  return (
    devices.find((d) => d.type === 'grid' && d.is_active !== false) ?? null
  );
}
