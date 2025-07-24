import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeCard } from "@/components/settings/password-change-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ThemeSettingsCard } from "@/components/settings/theme-settings-card";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { ConfigurationAlert } from "@/components/settings/configuration-alert";
import { LocationSelector } from "@/components/settings/location-selector";
import { DeviceConfiguration } from "@/components/settings/device-configuration";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  // Fetch current profile data for location display
  const { data: profile } = await supabase
    .from("profiles")
    .select("city, state, zone_key")
    .eq("user_id", data.user.id)
    .single();

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
          {/* Location Settings Section */}
          <section id="location-settings" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>Set your home location for accurate energy grid data</CardDescription>
              </CardHeader>
              <CardContent>
                <LocationSelector initialProfile={profile || undefined} />
              </CardContent>
            </Card>
          </section>
          
          {/* Device Configuration Section */}
          <section id="device-configuration" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Configuration</CardTitle>
                <CardDescription>Configure your smart home devices and energy systems</CardDescription>
              </CardHeader>
              <CardContent>
                <DeviceConfiguration />
              </CardContent>
            </Card>
          </section>
          

          {/* Notification Settings Section */}
          <section id="notification-settings" className="scroll-mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure alert preferences and notification types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">System Alerts</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">EV Charging Alerts</span>
                        <div className="text-xs text-muted-foreground">Notifications for charging start, completion, and issues</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Battery Status</span>
                        <div className="text-xs text-muted-foreground">Battery charge level and health updates</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Solar Performance</span>
                        <div className="text-xs text-muted-foreground">Solar generation and efficiency alerts</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Cost Savings</span>
                        <div className="text-xs text-muted-foreground">Daily and monthly savings achievements</div>
                      </div>
                      <Badge variant="outline">Disabled</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Maintenance Reminders</span>
                        <div className="text-xs text-muted-foreground">Scheduled maintenance and cleaning alerts</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Performance Notifications</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Efficiency Warnings</span>
                        <div className="text-xs text-muted-foreground">System efficiency drops below threshold</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Weather Impact</span>
                        <div className="text-xs text-muted-foreground">Weather conditions affecting solar generation</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Grid Events</span>
                        <div className="text-xs text-muted-foreground">Power outages and grid connection status</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Emergency Contacts</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Primary Contact</span>
                        <div className="text-xs text-muted-foreground">+1 (555) 123-4567</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Backup Contact</span>
                        <div className="text-xs text-muted-foreground">+1 (555) 987-6543</div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">Technician</span>
                        <div className="text-xs text-muted-foreground">+1 (555) 456-7890</div>
                      </div>
                      <Badge variant="outline">On-Call</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="default" size="sm">Save Changes</Button>
                  <Button variant="outline" size="sm">Reset to Defaults</Button>
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