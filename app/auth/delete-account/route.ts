import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger({ route: '/auth/delete-account' });

export async function POST(req: NextRequest) {
  const reqLog = log.child({ request_id: req.headers.get('x-request-id') ?? undefined });
  try {
    const supabase = await createClient();
    
    // Get the current user from the session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userReqLog = reqLog.child({ user_id: user.id });

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      userReqLog.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    // Create admin client for user deletion
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Delete the user account using admin privileges
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    reqLog.error("Delete account error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
} 