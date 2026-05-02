/**
 * Synthetic device records for system-level adapters (house aggregate +
 * grid). The user's account doesn't store these as real devices, but the
 * adapter contract is per-device, so routes that need system-level data
 * (snapshot, history) materialize them on the fly and pass them through
 * `createAdapter` like any other device. This keeps simulation calls behind
 * the adapter layer.
 */

import type { DeviceRecord } from '@/lib/adapters/types';

export function makeHouseDevice(userId: string): DeviceRecord {
  return {
    id: `system-house-${userId}`,
    user_id: userId,
    name: 'House',
    type: 'house',
    is_active: true,
    provider_type: 'simulated',
    connection_config: {},
  };
}

export function makeGridDevice(userId: string): DeviceRecord {
  return {
    id: `system-grid-${userId}`,
    user_id: userId,
    name: 'Grid',
    type: 'grid',
    is_active: true,
    provider_type: 'simulated',
    connection_config: {},
  };
}
