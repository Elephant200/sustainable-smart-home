/**
 * GET /api/configuration/devices/health
 *
 * Returns per-device connection health for the authenticated user's active
 * non-simulated devices. Used by the settings page device status cards and
 * the dashboard disconnection banner.
 *
 * Response shape:
 * {
 *   devices: Array<{
 *     device_id: string;
 *     name: string;
 *     type: string;
 *     provider_type: string;
 *     status: 'live' | 'stale' | 'disconnected' | 'never_synced';
 *     last_sync_at: string | null;       // ISO timestamp
 *     last_success_at: string | null;
 *     last_error_at: string | null;
 *     last_error_message: string | null;
 *     consecutive_failures: number;
 *   }>
 * }
 *
 * Status definitions:
 *   live         — last_success_at within the stale threshold (default 1h)
 *   stale        — last_success_at exists but older than the threshold
 *   disconnected — consecutive_failures >= DISCONNECTED_THRESHOLD (default 3)
 *                  OR last_error_at is set and no subsequent success
 *   never_synced — no sync state record yet
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkReadRateLimit } from '@/lib/api/rate-limit';

const STALE_THRESHOLD_SEC = parseInt(
  process.env.DEVICE_STALE_THRESHOLD_SEC ?? '3600',
  10
);
const DISCONNECTED_THRESHOLD = 3;

type DeviceHealthStatus = 'live' | 'stale' | 'disconnected' | 'never_synced';

function computeStatus(syncState: {
  last_success_at: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
} | null): DeviceHealthStatus {
  if (!syncState) return 'never_synced';

  const { last_success_at, last_error_at, consecutive_failures } = syncState;

  // Any active failure threshold → disconnected immediately.
  if (consecutive_failures >= DISCONNECTED_THRESHOLD) return 'disconnected';

  // A more-recent error than the last success means the device is disconnected,
  // even if only 1–2 consecutive failures have occurred.
  if (last_error_at && last_success_at) {
    const errorTs = new Date(last_error_at).getTime();
    const successTs = new Date(last_success_at).getTime();
    if (errorTs > successTs) return 'disconnected';
  }

  if (!last_success_at) {
    return last_error_at ? 'disconnected' : 'never_synced';
  }

  const ageSec = (Date.now() - new Date(last_success_at).getTime()) / 1000;
  return ageSec <= STALE_THRESHOLD_SEC ? 'live' : 'stale';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitError = checkReadRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select('id, name, type, provider_type')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .neq('provider_type', 'simulated');

  if (devicesError) {
    return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 });
  }

  const deviceList = devices ?? [];
  const deviceIds = deviceList.map((d) => d.id);

  const syncStateMap = new Map<string, {
    last_sync_at: string | null;
    last_success_at: string | null;
    last_error_at: string | null;
    last_error_message: string | null;
    consecutive_failures: number;
  }>();

  if (deviceIds.length > 0) {
    const { data: syncRows } = await supabase
      .from('device_sync_state')
      .select('device_id, last_sync_at, last_success_at, last_error_at, last_error_message, consecutive_failures')
      .in('device_id', deviceIds);

    for (const row of syncRows ?? []) {
      syncStateMap.set(row.device_id, {
        last_sync_at: row.last_sync_at,
        last_success_at: row.last_success_at,
        last_error_at: row.last_error_at,
        last_error_message: row.last_error_message,
        consecutive_failures: row.consecutive_failures ?? 0,
      });
    }
  }

  const result = deviceList.map((device) => {
    const syncState = syncStateMap.get(device.id) ?? null;
    return {
      device_id: device.id,
      name: device.name,
      type: device.type,
      provider_type: device.provider_type,
      status: computeStatus(syncState),
      last_sync_at: syncState?.last_sync_at ?? null,
      last_success_at: syncState?.last_success_at ?? null,
      last_error_at: syncState?.last_error_at ?? null,
      last_error_message: syncState?.last_error_message ?? null,
      consecutive_failures: syncState?.consecutive_failures ?? 0,
    };
  });

  return NextResponse.json({ devices: result });
}
