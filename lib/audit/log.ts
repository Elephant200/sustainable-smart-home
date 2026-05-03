import { createServiceClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: 'lib/audit/log' });

export type AuditAction =
  | 'device.create'
  | 'device.update'
  | 'device.delete'
  | 'credential.write'
  | 'oauth.connect'
  | 'oauth.disconnect'
  | 'command.send'
  | 'location.update';

/**
 * Integration hook: call recordAuditEvent({ action: 'oauth.connect', ... })
 * from your OAuth callback route (e.g. /api/auth/callback/[provider]) after
 * a provider token is successfully exchanged and stored.
 *
 * Integration hook: call recordAuditEvent({ action: 'oauth.disconnect', ... })
 * from your provider disconnect route when a stored OAuth token is revoked.
 *
 * Integration hook: call recordAuditEvent({ action: 'command.send', ... })
 * from any route that sends a control command to a device (e.g. set charge
 * limit, start/stop charging, change mode).
 */

export interface AuditEventParams {
  userId: string;
  action: AuditAction;
  deviceId?: string | null;
  actorIp?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      device_id: params.deviceId ?? null,
      actor_ip: params.actorIp ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    log.error('Failed to record audit event', { error: err instanceof Error ? err.message : String(err) });
  }
}
