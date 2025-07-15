"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Sun, 
  Battery, 
  Car, 
  BarChart3, 
  Bell, 
  Settings 
} from "lucide-react";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/app",
    icon: LayoutDashboard,
    description: "Real-time energy monitoring and control"
  },
  {
    name: "Solar Power",
    href: "/app/solar",
    icon: Sun,
    description: "Solar panel performance and generation"
  },
  {
    name: "Battery Storage",
    href: "/app/battery",
    icon: Battery,
    description: "Battery storage optimization"
  },
  {
    name: "EV Charging",
    href: "/app/ev-charging",
    icon: Car,
    description: "Electric vehicle charging management"
  },
  {
    name: "Analytics",
    href: "/app/analytics",
    icon: BarChart3,
    description: "Energy usage analytics and sustainability metrics"
  },
  {
    name: "Alerts",
    href: "/app/alerts",
    icon: Bell,
    description: "System notifications and alerts"
  },
  {
    name: "Settings",
    href: "/app/settings",
    icon: Settings,
    description: "System settings and preferences"
  }
];

export function DashboardSidenav() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-background border-r min-h-screen flex flex-col">
      {/* Logo and Title */}
      <div className="p-6 border-b">
        <Link href="/app" className="flex items-center gap-3">
          <Image 
            src="/favicon.ico" 
            alt="Sustainable Smart Home" 
            width={32} 
            height={32}
            className="rounded-sm"
          />
          <div>
            <h1 className="font-semibold text-sm">Sustainable Smart Home</h1>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
} 