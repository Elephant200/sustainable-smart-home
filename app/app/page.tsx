import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-2">Dashboard Page</h2>
        <p className="text-muted-foreground">
          This is the Dashboard skeleton page. Real-time energy monitoring and control features will be implemented here.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Energy Overview</h3>
          <p className="text-sm text-muted-foreground">Real-time energy consumption</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">System Status</h3>
          <p className="text-sm text-muted-foreground">Current system health</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Quick Actions</h3>
          <p className="text-sm text-muted-foreground">Frequently used controls</p>
        </div>
      </div>
    </div>
  );
}
