import { createClient } from "@/lib/supabase/server";
import { getUserZoneKey } from "@/lib/user-profile";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const location = await getUserZoneKey(user.id);
    
    const { data, error } = await supabase.from("grid_data").select("*").eq("zone", location);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
      if (error.message === "Profile not found") {
        return NextResponse.json({ error: "Profile not found" }, { status: 500 });
      }
      if (error.message === "Zone key not found in profile") {
        return NextResponse.json({ error: "Location not found" }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}