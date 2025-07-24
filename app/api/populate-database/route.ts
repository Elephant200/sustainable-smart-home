import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { populateUserData, clearUserData } from '@/lib/data-generator/populate-database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const force = searchParams.get('force') === 'true';
    
    if (action === 'clear') {
      const result = await clearUserData(user.id);
      return NextResponse.json(result);
    } else if (action === 'populate') {
      const result = await populateUserData(user.id, force);
      return NextResponse.json(result);
    } else if (action === 'count') {
      // Check how much data exists
      const { data: solarCount } = await supabase
        .from('power_generation')
        .select('timestamp', { count: 'exact' })
        .eq('user_id', user.id);
      
      const { data: houseLoadCount } = await supabase
        .from('house_load')
        .select('timestamp', { count: 'exact' })
        .eq('user_id', user.id);
      
      // Get date range
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
      // Default status endpoint
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
    console.error('Error in populate-database API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 