import { createClient } from "@/lib/supabase/server";
import { getUserZoneKey } from "@/lib/user-profile";
import { NextRequest, NextResponse } from "next/server";
import { checkReadRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validate";
import { z } from "zod";

const NoQuerySchema = z.object({}).strict();

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitError = checkReadRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

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
