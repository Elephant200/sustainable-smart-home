import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProviderType } from '@/lib/adapters/types';
import { encryptConnectionConfig } from '@/lib/crypto/connection-config';
import { checkWriteRateLimit } from '@/lib/api/rate-limit';
import { validateBody, validateQuery, validateParams, parseBody, getClientIp } from '@/lib/api/validate';
import { recordAuditEvent } from '@/lib/audit/log';
import { z } from 'zod';

const VALID_PROVIDER_TYPES: ProviderType[] = [
  'simulated', 'tesla', 'enphase', 'home_assistant', 'solaredge', 'emporia'
];

const VALID_DEVICE_TYPES = ['solar_array', 'battery', 'ev', 'grid', 'house'] as const;

const PutDeviceSchema = z.object({
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

const DeviceIdSchema = z.string().uuid();
const NoQuerySchema = z.object({}).strict();

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitError = checkWriteRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const rawId = (await params).id;
  const pr = validateParams(z.object({ id: z.string().uuid() }), { id: rawId });
  if (pr.error) return pr.error;
  const deviceId = pr.data.id;

  const bodyResult = await parseBody(req);
  if (bodyResult.error) return bodyResult.error;

  const vr = validateBody(PutDeviceSchema, bodyResult.data);
  if (vr.error) return vr.error;
  const { name, type, provider_type, connection_config, ...config } = vr.data;
  const actorIp = getClientIp(req);

  // Validate all type-specific required fields BEFORE any DB writes so that
  // invalid requests are rejected with 400 without mutating any records.
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

  try {
    const { data: existingDevice, error: checkError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .single();

    if (checkError || !existingDevice) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const resolvedProvider: ProviderType =
      provider_type && VALID_PROVIDER_TYPES.includes(provider_type)
        ? provider_type
        : (existingDevice.provider_type ?? 'simulated');

    const updatePayload: Record<string, unknown> = {
      name,
      type,
      provider_type: resolvedProvider,
    };

    const isMaskedPlaceholder =
      typeof connection_config === 'object' &&
      connection_config !== null &&
      'is_configured' in connection_config;

    const hasNewCredentials =
      !isMaskedPlaceholder &&
      typeof connection_config === 'object' &&
      connection_config !== null &&
      Object.keys(connection_config).length > 0;

    if (hasNewCredentials) {
      updatePayload.connection_config = encryptConnectionConfig(
        connection_config as Record<string, unknown>
      );
    } else if (resolvedProvider !== existingDevice.provider_type) {
      updatePayload.connection_config = {};
    }

    const { error: deviceError } = await supabase
      .from('devices')
      .update(updatePayload)
      .eq('id', deviceId)
      .eq('user_id', user.id);

    if (deviceError) {
      console.error('Error updating device:', deviceError);
      return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
    }

    let configError = null;

    switch (type) {
      case 'solar_array':
        const { error: solarError } = await supabase
          .from('solar_config')
          .upsert({
            device_id: deviceId,
            panel_count: config.panel_count,
            output_per_panel_kw: config.output_per_panel_kw
          });
        configError = solarError;
        break;

      case 'battery':
        const { error: batteryError } = await supabase
          .from('battery_config')
          .upsert({
            device_id: deviceId,
            capacity_kwh: config.capacity_kwh,
            max_flow_kw: config.max_flow_kw
          });
        configError = batteryError;
        break;

      case 'ev':
        const { error: evError } = await supabase
          .from('ev_config')
          .upsert({
            device_id: deviceId,
            battery_capacity_kwh: config.battery_capacity_kwh,
            target_charge: config.target_charge,
            departure_time: config.departure_time,
            charger_power_kw: config.charger_power_kw
          });
        configError = evError;
        break;

      case 'grid':
      case 'house':
        break;
    }

    if (configError) {
      console.error('Error updating device config:', configError);
      return NextResponse.json({ error: 'Failed to update device configuration' }, { status: 500 });
    }

    const auditActions = [
      recordAuditEvent({
        userId: user.id,
        action: 'device.update',
        deviceId,
        actorIp,
        metadata: { name, type, provider_type: resolvedProvider },
      }),
    ];

    if (hasNewCredentials) {
      auditActions.push(
        recordAuditEvent({
          userId: user.id,
          action: 'credential.write',
          deviceId,
          actorIp,
          metadata: { provider_type: resolvedProvider },
        })
      );
    }

    await Promise.all(auditActions);

    return NextResponse.json({ 
      message: 'Device updated successfully',
      device: {
        id: deviceId,
        name,
        type,
        provider_type: resolvedProvider,
        ...config
      }
    });

  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitError = checkWriteRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const rawId = (await params).id;
  const pr = validateParams(z.object({ id: z.string().uuid() }), { id: rawId });
  if (pr.error) return pr.error;
  const deviceId = pr.data.id;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  const actorIp = getClientIp(req);

  try {
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('devices')
      .update({ is_active: false })
      .eq('id', deviceId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error deactivating device:', updateError);
      return NextResponse.json({ error: 'Failed to deactivate device' }, { status: 500 });
    }

    await recordAuditEvent({
      userId: user.id,
      action: 'device.delete',
      deviceId,
      actorIp,
      metadata: { name: device.name, type: device.type },
    });

    return NextResponse.json({ 
      message: 'Device deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating device:', error);
    return NextResponse.json({ error: 'Failed to deactivate device' }, { status: 500 });
  }
}
