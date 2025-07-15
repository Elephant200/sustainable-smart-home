import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeCard } from "@/components/settings/password-change-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ThemeSettingsCard } from "@/components/settings/theme-settings-card";
import { SettingsNavigation } from "@/components/settings/settings-navigation";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      {/* Keep the uppermost description card in place */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-2">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings, device configuration, and notification preferences.
        </p>
      </div>
      
      {/* Sidebar + Content Layout */}
      <div className="flex gap-6">
        {/* Left Navigation Sidebar */}
        <SettingsNavigation />
        
        {/* Right Content Area */}
        <div className="flex-1 space-y-8">
          {/* Account Settings Section */}
          <section id="account-settings" className="scroll-mt-6">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-2">Account Settings</h3>
              <p className="text-sm text-muted-foreground mb-6">Profile and account management</p>
              
              <div className="space-y-6">
                <div id="theme-settings" className="scroll-mt-6">
                  <ThemeSettingsCard />
                </div>
                
                <div id="password-change" className="scroll-mt-6">
                  <PasswordChangeCard />
                </div>
                
                <div id="delete-account" className="scroll-mt-6">
                  <DeleteAccountCard />
                </div>
              </div>
            </div>
          </section>
          
          {/* Device Configuration Section */}
          <section id="device-configuration" className="scroll-mt-6">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-2">Device Configuration</h3>
              <p className="text-sm text-muted-foreground mb-4">Configure your smart home devices</p>
              
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Device configuration options will be implemented here.</p>
                </div>
              </div>
            </div>
          </section>
          
          {/* Notification Settings Section */}
          <section id="notification-settings" className="scroll-mt-6">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-2">Notification Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">Alert and notification preferences</p>
              
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Notification settings will be implemented here.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 