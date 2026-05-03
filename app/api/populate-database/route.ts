import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { populateUserData, clearUserData } from '@/lib/data-generator/populate-database';
import { validateQuery } from '@/lib/api/validate';
import { checkWriteRateLimit } from '@/lib/api/rate-limit';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

const log = createLogger({ route: '/api/populate-database' });

const PopulateQuerySchema = z.object({
  action: z.enum(['populate', 'clear', 'count', 'status']).default('status'),
  force: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
}).strict();

export async function GET(request: NextRequest) {
  const reqLog = log.child({ request_id: request.headers.get('x-request-id') ?? undefined });

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Not available in production' },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const userReqLog = reqLog.child({ user_id: user.id });

    const rateLimitError = checkWriteRateLimit(request, user.id);
    if (rateLimitError) return rateLimitError;

    const qr = validateQuery(PopulateQuerySchema, request.nextUrl.searchParams);
    if (qr.error) return qr.error;

    const { action, force } = qr.data;
    
    if (action === 'clear') {
      const result = await clearUserData(user.id);
      return NextResponse.json(result);
    } else if (action === 'populate') {
      const result = await populateUserData(user.id, force ?? false);
      return NextResponse.json(result);
    } else if (action === 'count') {
      const { data: solarCount } = await supabase
        .from('power_generation')
        .select('timestamp', { count: 'exact' })
        .eq('user_id', user.id);
      
      const { data: houseLoadCount } = await supabase
        .from('house_load')
        .select('timestamp', { count: 'exact' })
        .eq('user_id', user.id);
      
      const { data: solarRange } = await supabase
        .from('power_generation')
        .select('timestamp')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true })
        .limit(1);
        
      const { data: solarRangeEnd } = await supabase
        .from('power_generation')
        .select('timestamp')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(1);
      
      return NextResponse.json({
        success: true,
        data: {
          solar_generation_points: solarCount?.length || 0,
          house_load_points: houseLoadCount?.length || 0,
          solar_date_range: {
            start: solarRange?.[0]?.timestamp || null,
            end: solarRangeEnd?.[0]?.timestamp || null
          }
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Database population API is ready',
        user_id: user.id,
        usage: {
          populate: 'GET /api/populate-database?action=populate',
          force_populate: 'GET /api/populate-database?action=populate&force=true (regenerates full year)',
          count: 'GET /api/populate-database?action=count (check data in database)',
          clear: 'GET /api/populate-database?action=clear',
          status: 'GET /api/populate-database (default)'
        }
      });
    }
    
  } catch (error) {
    reqLog.error('Error in populate-database API', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
