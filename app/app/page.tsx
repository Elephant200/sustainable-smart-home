import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 items-center">
      <div className="flex flex-col gap-2 items-center text-center">
        <h2 className="font-bold text-2xl mb-4">Welcome, {data.user.user_metadata.first_name}!</h2>
        <p className="text-muted-foreground">
          This is your personal dashboard. You can build your sustainable smart home features here.
        </p>
      </div>
    </div>
  );
}
