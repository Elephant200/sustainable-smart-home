import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidenav } from "@/components/layout/dashboard-sidenav";
import { DashboardWrapper } from "@/components/layout/dashboard-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidenav />
      <div className="flex-1 flex flex-col">
        <DashboardWrapper user={data.user}>
          {children}
        </DashboardWrapper>
      </div>
    </div>
  );
}
