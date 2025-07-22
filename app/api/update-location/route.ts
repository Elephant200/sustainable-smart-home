import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {

  const supabase = await createClient();  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { streetAddress, city, state, zipCode, country } = await request.json();

  // Construct the full address for geocoding
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}, ${country}`;
  
  // Use Google Maps Geocoding API to get lat/lng from address
  const encodedAddress = encodeURIComponent(fullAddress);
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
  const data = await response.json();

  if (!response.ok || !data.results || data.results.length === 0) {
    return NextResponse.json({ error: "Could not geocode address" }, { status: 400 });
  }

  const location = data.results[0].geometry.location;
  const lat = location.lat;
  const lng = location.lng;

  // Get zone key from ElectricityMaps API
  let zoneKey: string;
  try {
    const url = `https://api.electricitymaps.com/v3/carbon-intensity/latest?lat=${lat}&lon=${lng}`;
    const headers = {
      "auth-token": process.env.ELECTRICITYMAPS_API_KEY!,
    };
    
    const zoneResponse = await fetch(url, { headers });
    
    if (zoneResponse.status === 401) {
      const errorData = await zoneResponse.json();
      const errorMessage = errorData.error;
      if (errorMessage && errorMessage.startsWith("Request unauthorized for zoneKey=")) {
        zoneKey = errorMessage.split("Request unauthorized for zoneKey=")[1].split(",")[0];
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
    console.error('Error getting zone key:', error);
    return NextResponse.json({ error: "Failed to get energy zone" }, { status: 500 });
  }

  // Update user profile with location data
  const { error: updateError } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      city: city,
      state: state,
      zone_key: zoneKey,
    });

  if (updateError) {
    console.error('Error updating profile:', updateError);
    return NextResponse.json({ error: "Failed to save location to profile" }, { status: 500 });
  }

  return NextResponse.json({ 
    latitude: lat,
    longitude: lng,
    zone_key: zoneKey,
    message: "Location saved successfully"
  });
}