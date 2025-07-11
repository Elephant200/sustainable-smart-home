import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailVerificationCard } from "@/components/settings/email-verification-card";
import { PasswordChangeCard } from "@/components/settings/password-change-card";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  const isEmailVerified = data.user.email_confirmed_at !== null;

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <a href="/">Sustainable Smart Home</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-sm hover:underline">Dashboard</a>
            </div>
          </div>
        </nav>
        
        <div className="flex-1 flex flex-col max-w-2xl p-8 w-full gap-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences</p>
          </div>
          
          <EmailVerificationCard 
            userEmail={data.user.email!} 
            isVerified={isEmailVerified} 
          />
          
          <PasswordChangeCard isEmailVerified={isEmailVerified} />
        </div>
      </div>
    </main>
  );
} 