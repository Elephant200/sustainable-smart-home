import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ProviderType } from '@/lib/adapters/types';
import {
  encryptConnectionConfig,
  maskForClient,
} from '@/lib/crypto/connection-config';
import { checkReadRateLimit, checkWriteRateLimit } from '@/lib/api/rate-limit';
import { validateBody, validateQuery, parseBody, getClientIp } from '@/lib/api/validate';
import { recordAuditEvent } from '@/lib/audit/log';
import { createLogger } from '@/lib/logger';
import { reportError } from '@/lib/reporter';
import { z } from 'zod';

const VALID_PROVIDER_TYPES: ProviderType[] = [
  'simulated', 'tesla', 'enphase', 'home_assistant', 'solaredge', 'emporia'
];

const VALID_DEVICE_TYPES = ['solar_array', 'battery', 'ev', 'grid', 'house'] as const;

const NoQuerySchema = z.object({}).strict();

const PostDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(VALID_DEVICE_TYPES),
  provider_type: z.enum(['simulated', 'tesla', 'enphase', 'home_assistant', 'solaredge', 'emporia']).optional(),
  connection_config: z.record(z.unknown()).optional(),
  panel_count: z.number().positive().optional(),
  output_per_panel_kw: z.number().positive().optional(),
  capacity_kwh: z.number().positive().optional(),
  max_flow_kw: z.number().positive().optional(),
  battery_capacity_kwh: z.number().positive().optional(),
  target_charge: z.number().int().min(1).max(100).optional(),
  departure_time: z.string().optional(),
  charger_power_kw: z.number().positive().optional(),
}).strict();

export async function GET(req: NextRequest) {
  const hdrs = await headers();
  const log = createLogger({ route: '/api/configuration/devices', request_id: hdrs.get('x-request-id') ?? undefined });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const routeLog = log.child({ user_id: user.id });

  const rateLimitError = checkReadRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  try {
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: true });

    if (devicesError) {
      routeLog.error('Error fetching devices', { error: devicesError.message });
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
    }

    const devicesWithConfig = await Promise.all(
      devices.map(async (device) => {
        let config = null;

        switch (device.type) {
          case 'solar_array': {
            const { data: solarConfig } = await supabase
              .from('solar_config')
              .select('*')
              .eq('device_id', device.id)
              .single();
            config = solarConfig;
            break;
          }
          case 'battery': {
            const { data: batteryConfig } = await supabase
              .from('battery_config')
              .select('*')
              .eq('device_id', device.id)
              .single();
            config = batteryConfig;
            break;
          }
          case 'ev': {
            const { data: evConfig } = await supabase
              .from('ev_config')
              .select('*')
              .eq('device_id', device.id)
              .single();
            config = evConfig;
            break;
          }
          case 'grid':
          case 'house':
            break;
        }

        return {
          ...device,
          provider_type: device.provider_type ?? 'simulated',
          connection_config: maskForClient(device.connection_config ?? {}),
          config: config || {}
        };
      })
    );

    return NextResponse.json({ devices: devicesWithConfig });

  } catch (error) {
    routeLog.error('Unexpected error fetching devices', { error: error instanceof Error ? error.message : String(error) });
    reportError(error, { route: '/api/configuration/devices', userId: user.id });
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const hdrs = await headers();
  const log = createLogger({ route: '/api/configuration/devices', request_id: hdrs.get('x-request-id') ?? undefined });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitError = checkWriteRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const bodyResult = await parseBody(req);
  if (bodyResult.error) return bodyResult.error;

  const vr = validateBody(PostDeviceSchema, bodyResult.data);
  if (vr.error) return vr.error;

  const { name, type, provider_type, connection_config, ...config } = vr.data;

  // Validate all type-specific required fields BEFORE any DB writes so that
  // invalid requests are rejected with 400 without creating partial records.
  switch (type) {
    case 'solar_array':
      if (!config.panel_count || !config.output_per_panel_kw) {
        return NextResponse.json({ error: 'Panel count and output per panel are required for solar arrays' }, { status: 400 });
      }
      break;
    case 'battery':
      if (!config.capacity_kwh || !config.max_flow_kw) {
        return NextResponse.json({ error: 'Capacity and max flow are required for batteries' }, { status: 400 });
      }
      break;
    case 'ev':
      if (!config.battery_capacity_kwh || !config.target_charge || !config.departure_time || !config.charger_power_kw) {
        return NextResponse.json({ error: 'All EV configuration fields are required' }, { status: 400 });
      }
      break;
  }

  const resolvedProvider: ProviderType =
    provider_type && VALID_PROVIDER_TYPES.includes(provider_type)
      ? provider_type
      : 'simulated';

  const encryptedConfig = encryptConnectionConfig(
    typeof connection_config === 'object' && connection_config !== null
      ? connection_config
      : {}
  );

  const actorIp = getClientIp(req);

  try {
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({
        user_id: user.id,
        name: name,
        type: type,
        is_active: true,
        provider_type: resolvedProvider,
        connection_config: encryptedConfig,
      })
      .select()
      .single();

    if (deviceError) {
      log.error('Error inserting device', { error: deviceError.message, user_id: user.id });
      return NextResponse.json({ error: 'Failed to create device' }, { status: 500 });
    }

    let configError = null;

    switch (type) {
      case 'solar_array': {
        const { error: solarError } = await supabase
          .from('solar_config')
          .insert({
            device_id: device.id,
            panel_count: config.panel_count,
            output_per_panel_kw: config.output_per_panel_kw
          });
        configError = solarError;
        break;
      }
      case 'battery': {
        const { error: batteryError } = await supabase
          .from('battery_config')
          .insert({
            device_id: device.id,
            capacity_kwh: config.capacity_kwh,
            max_flow_kw: config.max_flow_kw
          });
        configError = batteryError;

        const { error: stateError } = await supabase
          .from('battery_state')
          .insert({
            device_id: device.id,
            timestamp: new Date(Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60)),
            soc_percent: 50,
            soc_kwh: config.capacity_kwh! * 0.5,
          });
        if (stateError) {
          log.warn('Error inserting battery state', { error: stateError.message });
          if (!configError) configError = stateError;
        }
        break;
      }
      case 'ev': {
        const { error: evError } = await supabase
          .from('ev_config')
          .insert({
            device_id: device.id,
            battery_capacity_kwh: config.battery_capacity_kwh,
            target_charge: config.target_charge,
            departure_time: config.departure_time,
            charger_power_kw: config.charger_power_kw
          });
        configError = evError;

        const { error: evStateError } = await supabase
          .from('ev_charge_sessions')
          .insert({
            user_id: user.id,
            device_id: device.id,
            timestamp: new Date(Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60)),
            soc_percent: 50,
            plugged_in: true,
          });
        if (evStateError) {
          log.warn('Error inserting ev state', { error: evStateError.message });
          if (!configError) configError = evStateError;
        }
        break;
      }
      case 'grid':
      case 'house':
        break;
    }

    if (configError) {
      log.error('Error inserting device config', { error: configError.message, user_id: user.id });
      await supabase.from('devices').delete().eq('id', device.id);
      return NextResponse.json({ error: 'Failed to create device configuration' }, { status: 500 });
    }

    const hasCredentials = typeof connection_config === 'object' &&
      connection_config !== null &&
      Object.keys(connection_config).length > 0;

    await Promise.all([
      recordAuditEvent({
        userId: user.id,
        action: 'device.create',
        deviceId: device.id,
        actorIp,
        metadata: { name, type, provider_type: resolvedProvider },
      }),
      hasCredentials && recordAuditEvent({
        userId: user.id,
        action: 'credential.write',
        deviceId: device.id,
        actorIp,
        metadata: { provider_type: resolvedProvider },
      }),
    ]);

    return NextResponse.json({ 
      message: 'Device created successfully',
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        provider_type: resolvedProvider,
        ...config
      }
    });

  } catch (error) {
    log.error('Unexpected error creating device', { error: error instanceof Error ? error.message : String(error), user_id: user.id });
    reportError(error, { route: '/api/configuration/devices', userId: user.id });
    return NextResponse.json({ error: 'Failed to create device' }, { status: 500 });
  }
}
