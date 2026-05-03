import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger({ route: '/auth/confirm' });

async function createDefaultProfile(userId: string) {
  const supabase = await createClient();
  
  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  
  if (existingProfile) {
    log.info("Profile already exists for user", { user_id: userId });
    return;
  }
  
  // Create profile with default Los Angeles settings
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      city: "Los Angeles",
      state: "California", 
      zone_key: "US-CAL-CISO",
      configured: true
    });
    
  if (profileError) {
    log.error("Error creating default profile", { user_id: userId, error: profileError.message });
    throw profileError;
  }
  
  log.info("Default profile created for user", { user_id: userId });
}

export async function GET(request: NextRequest) {
  const reqLog = log.child({ request_id: request.headers.get('x-request-id') ?? undefined });
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (token_hash && type) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    
    if (!error && data.user) {
      // Email verified successfully
      try {
        // Create default profile for new user
        await createDefaultProfile(data.user.id);
      } catch (profileError) {
        reqLog.error("Failed to create default profile", { user_id: data.user.id, error: profileError instanceof Error ? profileError.message : String(profileError) });
        // Don't fail the verification because of profile creation error
        // The user can set up their profile later in settings
      }
      
      // Redirect to next page
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=Invalid verification link`);
} 