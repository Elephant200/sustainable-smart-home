import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active devices for the user
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: true });

    if (devicesError) {
      console.error('Error fetching devices:', devicesError);
      return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
    }

    // Get configurations for each device type
    const devicesWithConfig = await Promise.all(
      devices.map(async (device) => {
        let config = null;

        switch (device.type) {
          case 'solar_array':
            const { data: solarConfig } = await supabase
              .from('solar_config')
              .select('*')
              .eq('device_id', device.id)
              .single();
            config = solarConfig;
            break;

          case 'battery':
            const { data: batteryConfig } = await supabase
              .from('battery_config')
              .select('*')
              .eq('device_id', device.id)
              .single();
            config = batteryConfig;
            break;

          case 'ev':
            const { data: evConfig } = await supabase
              .from('ev_config')
              .select('*')
              .eq('device_id', device.id)
              .single();
            config = evConfig;
            break;

          case 'grid':
          case 'house':
            // No additional configuration for these device types
            break;
        }

        return {
          ...device,
          config: config || {}
        };
      })
    );

    return NextResponse.json({ 
      devices: devicesWithConfig
    });

  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestData = await request.json();
  const { name, type, ...config } = requestData;

  // Validate required fields
  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  // Validate device type
  const validTypes = ['solar_array', 'battery', 'ev', 'grid', 'house'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
  }

  try {
    // Insert device into devices table
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({
        user_id: user.id,
        name: name,
        type: type,
        is_active: true
      })
      .select()
      .single();

    if (deviceError) {
      console.error('Error inserting device:', deviceError);
      return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
    }

    // Insert device-specific configuration if needed
    let configError = null;

    switch (type) {
      case 'solar_array':
        if (!config.panel_count || !config.output_per_panel_kw) {
          return NextResponse.json({ error: "Panel count and output per panel are required for solar arrays" }, { status: 400 });
        }
        const { error: solarError } = await supabase
          .from('solar_config')
          .insert({
            device_id: device.id,
            panel_count: config.panel_count,
            output_per_panel_kw: config.output_per_panel_kw
          });
        configError = solarError;
        break;

      case 'battery':
        if (!config.capacity_kwh || !config.max_flow_kw) {
          return NextResponse.json({ error: "Capacity and max flow are required for batteries" }, { status: 400 });
        }
        const { error: batteryError } = await supabase
          .from('battery_config')
          .insert({
            device_id: device.id,
            capacity_kwh: config.capacity_kwh,
            max_flow_kw: config.max_flow_kw
          });
        configError = batteryError;
        break;

      case 'ev':
        if (!config.battery_capacity_kwh || !config.target_charge || !config.departure_time || !config.charger_power_kw) {
          return NextResponse.json({ error: "All EV configuration fields are required" }, { status: 400 });
        }
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
        break;

      case 'grid':
      case 'house':
        // No additional configuration needed for grid and house devices
        break;
    }

    if (configError) {
      console.error('Error inserting device config:', configError);
      // Clean up the device if config insertion failed
      await supabase.from('devices').delete().eq('id', device.id);
      return NextResponse.json({ error: "Failed to create device configuration" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Device created successfully",
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        ...config
      }
    });

  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
} 