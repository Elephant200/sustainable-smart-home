import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = (await params).id;
  const requestData = await request.json();
  const { name, type, ...config } = requestData;

  // Validate required fields
  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  try {
    // First, check if device exists and user owns it
    const { data: existingDevice, error: checkError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .single();

    if (checkError || !existingDevice) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Update device name and type
    const { error: deviceError } = await supabase
      .from('devices')
      .update({
        name: name,
        type: type
      })
      .eq('id', deviceId)
      .eq('user_id', user.id);

    if (deviceError) {
      console.error('Error updating device:', deviceError);
      return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
    }

    // Update device-specific configuration
    let configError = null;

    switch (type) {
      case 'solar_array':
        if (!config.panel_count || !config.output_per_panel_kw) {
          return NextResponse.json({ error: "Panel count and output per panel are required for solar arrays" }, { status: 400 });
        }
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
        if (!config.capacity_kwh || !config.max_flow_kw) {
          return NextResponse.json({ error: "Capacity and max flow are required for batteries" }, { status: 400 });
        }
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
        if (!config.battery_capacity_kwh || !config.target_charge || !config.departure_time || !config.charger_power_kw) {
          return NextResponse.json({ error: "All EV configuration fields are required" }, { status: 400 });
        }
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
        // No additional configuration needed for grid and house devices
        break;
    }

    if (configError) {
      console.error('Error updating device config:', configError);
      return NextResponse.json({ error: "Failed to update device configuration" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Device updated successfully",
      device: {
        id: deviceId,
        name: name,
        type: type,
        ...config
      }
    });

  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = (await params).id;

  try {
    // First, check if device exists and user owns it
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Soft delete: set is_active to false instead of deleting
    const { error: updateError } = await supabase
      .from('devices')
      .update({ is_active: false })
      .eq('id', deviceId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error deactivating device:', updateError);
      return NextResponse.json({ error: "Failed to deactivate device" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Device deactivated successfully"
    });

  } catch (error) {
    console.error('Error deactivating device:', error);
    return NextResponse.json({ error: "Failed to deactivate device" }, { status: 500 });
  }
} 