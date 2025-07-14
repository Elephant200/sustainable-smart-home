import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeCard } from "@/components/settings/password-change-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ThemeSettingsCard } from "@/components/settings/theme-settings-card";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl p-8 w-full gap-8">
      <div id="settings-header">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>
      
      <section id="theme-settings">
        <ThemeSettingsCard />
      </section>
      
      <section id="password-reset">
        <PasswordChangeCard />
      </section>
      
      <section id="delete-account">
        <DeleteAccountCard />
      </section>
    </div>
  );
} 