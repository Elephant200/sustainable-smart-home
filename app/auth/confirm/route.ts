import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

async function createDefaultProfile(userId: string) {
  const supabase = await createClient();
  
  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  
  if (existingProfile) {
    console.log("Profile already exists for user:", userId);
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
    console.error("Error creating default profile:", profileError);
    throw profileError;
  }
  
  console.log("Default profile created for user:", userId);
}

export async function GET(request: NextRequest) {
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
        console.error("Failed to create default profile:", profileError);
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