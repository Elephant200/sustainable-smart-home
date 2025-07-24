import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '24h';
    
    // Use current time as end date
    const endDate = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case "24h":
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "3m":
        startDate = new Date(endDate.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    }

    console.log(`Solar API: Fetching ${timeRange} data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch solar generation data from database
    const { data: solarData, error: dbError } = await supabase
      .from('power_generation')
      .select('device_id, energy_kwh, timestamp')
      .eq('user_id', user.id)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch solar generation data from database' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!solarData || solarData.length === 0) {
      console.log(`Solar API: No data found for range ${startDate.toISOString()} to ${endDate.toISOString()}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No solar generation data found. Please populate the database first.' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Solar API: Found ${solarData.length} data points for ${timeRange}`);

    // Group by timestamp and sum total generation for all arrays
    const groupedData: { [key: string]: number } = {};
    
    solarData.forEach(point => {
      const key = point.timestamp;
      if (!groupedData[key]) {
        groupedData[key] = 0;
      }
      groupedData[key] += point.energy_kwh;
    });
    
    // Transform data for chart
    const chartData = Object.entries(groupedData)
      .map(([timestamp, total_generation_kwh]) => ({
        timestamp,
        total_generation_kwh: Number(total_generation_kwh.toFixed(2)),
        hour: new Date(timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`Solar API: Returning ${chartData.length} chart points, latest: ${chartData[chartData.length - 1]?.timestamp}`);

    // Always return 1-hour granularity data regardless of time range
    return new Response(JSON.stringify({ 
      success: true, 
      data: chartData 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching solar data:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch solar generation data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 