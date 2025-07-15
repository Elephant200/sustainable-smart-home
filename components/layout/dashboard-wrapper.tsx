"use client";

import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";

const pageInfo = {
  "/app": {
    title: "Dashboard",
    subtitle: "Real-time energy monitoring and control"
  },
  "/app/solar": {
    title: "Solar Power",
    subtitle: "Solar panel performance and generation"
  },
  "/app/battery": {
    title: "Battery Storage", 
    subtitle: "Battery storage optimization"
  },
  "/app/ev-charging": {
    title: "EV Charging",
    subtitle: "Electric vehicle charging management"
  },
  "/app/analytics": {
    title: "Analytics",
    subtitle: "Energy usage analytics and sustainability metrics"
  },
  "/app/alerts": {
    title: "Alerts",
    subtitle: "System notifications and alerts"
  },
  "/app/settings": {
    title: "Settings",
    subtitle: "System settings and preferences"
  }
};

interface DashboardWrapperProps {
  children: React.ReactNode;
  user: User;
}

export function DashboardWrapper({ children, user }: DashboardWrapperProps) {
  const pathname = usePathname();
  const currentPage = pageInfo[pathname as keyof typeof pageInfo] || {
    title: "Dashboard",
    subtitle: "Real-time energy monitoring and control"
  };

  return (
    <>
      <DashboardTopbar 
        title={currentPage.title}
        subtitle={currentPage.subtitle}
        user={user}
      />
      <main className="flex-1 p-6">
        {children}
      </main>
    </>
  );
} 