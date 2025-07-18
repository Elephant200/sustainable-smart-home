import { createClient } from "@/lib/supabase/server";

export async function getUserZoneKey(userId: string) {
  const profileData = await getUserProfile(userId);

  if (!profileData.zone_key) {
    throw new Error("Zone key not found in profile");
  }

  return profileData.zone_key;
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profileError || !profileData) {
    throw new Error("Profile not found");
  }

  return profileData;
} 