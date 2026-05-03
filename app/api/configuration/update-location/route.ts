import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkWriteRateLimit } from '@/lib/api/rate-limit';
import { validateBody, parseBody, getClientIp } from '@/lib/api/validate';
import { recordAuditEvent } from '@/lib/audit/log';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

const log = createLogger({ route: '/api/configuration/update-location' });

const UpdateLocationSchema = z.object({
  streetAddress: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zipCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100),
}).strict();

export async function POST(req: NextRequest) {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reqLog = log.child({
    request_id: req.headers.get('x-request-id') ?? undefined,
    user_id: user.id,
  });

  const rateLimitError = checkWriteRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const bodyResult = await parseBody(req);
  if (bodyResult.error) return bodyResult.error;

  const vr = validateBody(UpdateLocationSchema, bodyResult.data);
  if (vr.error) return vr.error;

  const { streetAddress, city, state, zipCode, country } = vr.data;
  const actorIp = getClientIp(req);

  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}, ${country}`;
  const encodedAddress = encodeURIComponent(fullAddress);
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
  const data = await response.json();

  if (!response.ok || !data.results || data.results.length === 0) {
    return NextResponse.json({ error: 'Could not geocode address' }, { status: 400 });
  }

  const location = data.results[0].geometry.location;
  const lat = location.lat;
  const lng = location.lng;

  let zoneKey: string;
  try {
    const url = `https://api.electricitymaps.com/v3/carbon-intensity/latest?lat=${lat}&lon=${lng}`;
    const headers = {
      'auth-token': process.env.ELECTRICITYMAPS_API_KEY!,
    };
    
    const zoneResponse = await fetch(url, { headers });
    
    if (zoneResponse.status === 401) {
      const errorData = await zoneResponse.json();
      const errorMessage = errorData.error;
      if (errorMessage && errorMessage.startsWith('Request unauthorized for zoneKey=')) {
        zoneKey = errorMessage.split('Request unauthorized for zoneKey=')[1].split(',')[0];
      } else {
        throw new Error(`Unauthorized request: ${errorMessage}`);
      }
    } else if (!zoneResponse.ok) {
      const errorText = await zoneResponse.text();
      throw new Error(`Failed to get zone from coordinates. Status code ${zoneResponse.status}. ${errorText}`);
    } else {
      const zoneData = await zoneResponse.json();
      zoneKey = zoneData.zone;
    }
  } catch (error) {
    reqLog.error('Error getting zone key', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to get energy zone' }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      city: city,
      state: state,
      zone_key: zoneKey,
    });

  if (updateError) {
    reqLog.error('Error updating profile', { error: updateError.message });
    return NextResponse.json({ error: 'Failed to save location to profile' }, { status: 500 });
  }

  await recordAuditEvent({
    userId: user.id,
    action: 'location.update',
    actorIp,
    metadata: { city, state, zone_key: zoneKey },
  });

  return NextResponse.json({ 
    latitude: lat,
    longitude: lng,
    zone_key: zoneKey,
    message: 'Location saved successfully'
  });
}
