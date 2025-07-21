import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeCard } from "@/components/settings/password-change-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ThemeSettingsCard } from "@/components/settings/theme-settings-card";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { ConfigurationAlert } from "@/components/settings/configuration-alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      <ConfigurationAlert />
      {/* Keep the uppermost description card in place */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Manage your account settings, device configuration, and notification preferences.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* Sidebar + Content Layout */}
      <div className="flex gap-6">
        {/* Left Navigation Sidebar */}
        <SettingsNavigation />
        
        {/* Right Content Area */}
        <div className="flex-1 space-y-8">
          {/* Device Configuration Section */}
          <section id="device-configuration" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Configuration</CardTitle>
                <CardDescription>Configure your smart home devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Device configuration options will be implemented here.</p>
                </div>
              </CardContent>
            </Card>
          </section>
          
          {/* Optimization Preferences Section */}
          <section id="optimization-preferences" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Optimization Preferences</CardTitle>
                <CardDescription>Energy and cost optimization settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Optimization preferences will be implemented here.</p>
                </div>
              </CardContent>
            </Card>
          </section>
          
          {/* Notification Settings Section */}
          <section id="notification-settings" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Alert and notification preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Notification settings will be implemented here.</p>
                </div>
              </CardContent>
            </Card>
          </section>
          
          {/* Account Settings Section */}
          <section id="account-settings" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Profile and account management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div id="theme-settings" className="scroll-mt-6">
                  <ThemeSettingsCard />
                </div>
                
                <div id="password-change" className="scroll-mt-6">
                  <PasswordChangeCard />
                </div>
                
                <div id="delete-account" className="scroll-mt-6">
                  <DeleteAccountCard />
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
} 