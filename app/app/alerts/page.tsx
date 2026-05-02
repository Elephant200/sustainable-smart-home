"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell, Clock, Car, Battery, Sun, Zap,
  DollarSign, AlertTriangle, CheckCircle, Info, TrendingUp, Shield, Cloud,
} from "lucide-react";
import { SkeletonChartCard } from "@/components/ui/skeleton";
import { useAlerts, useAnalytics } from "@/lib/hooks/use-energy-data";
import type { AlertsResponse } from "@/lib/hooks/use-energy-data";

type Notification = AlertsResponse["alerts"][number];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  battery: Battery,
  car: Car,
  zap: Zap,
  cloud: Cloud,
  dollar: DollarSign,
  trending: TrendingUp,
  shield: Shield,
};

function NotificationCard({ notification }: { notification: Notification }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "text-primary bg-primary/10 border-primary/30";
      case "warning": return "text-warning bg-warning/10 border-warning/30";
      case "error": return "text-destructive bg-destructive/10 border-destructive/30";
      case "info": return "text-chart-2 bg-chart-2/10 border-chart-2/30";
      default: return "text-muted-foreground bg-muted/40 border-border";
    }
  };
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return CheckCircle;
      case "warning":
      case "error": return AlertTriangle;
      case "info": return Info;
      default: return Bell;
    }
  };
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge variant="destructive">High</Badge>;
      case "medium": return <Badge variant="default" className="bg-warning/15 text-warning border-warning/30">Medium</Badge>;
      case "low": return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">Normal</Badge>;
    }
  };
  const TypeIcon = getTypeIcon(notification.type);
  const CategoryIcon = ICON_MAP[notification.iconKey] ?? Bell;
  return (
    <Card className={`border-l-4 ${getTypeColor(notification.type)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4" />
            <CategoryIcon className="h-4 w-4" />
            <CardTitle className="text-base">{notification.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getPriorityBadge(notification.priority)}
            <Badge variant={notification.status === "active" ? "default" : "outline"}>
              {notification.status}
            </Badge>
          </div>
        </div>
        <CardDescription>{notification.category}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-2">{notification.message}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{notification.ageLabel}</span>
          {notification.status === "active" && (
            <Button variant="outline" size="sm">Dismiss</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const { data, loading, error } = useAlerts();
  const { data: analytics, loading: analyticsLoading } = useAnalytics();

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonChartCard height={120} />
        <SkeletonChartCard height={400} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Smart Home Notifications</CardTitle>
          <CardDescription>Unable to load alerts.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const notifications = data.alerts;
  const activeNotifications = notifications.filter((n) => n.status === "active");
  const recentNotifications = notifications.slice(0, 5);
  const priorityNotifications = notifications.filter(
    (n) => n.priority === "high" || n.priority === "medium"
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Smart Home Notifications</CardTitle>
          <CardDescription>
            Real-time system alerts, charging events, performance updates, and maintenance reminders
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-chart-2" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-2">{activeNotifications.length}</div>
            <div className="text-sm text-muted-foreground">Require attention</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Today&apos;s Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{notifications.length}</div>
            <div className="text-sm text-muted-foreground">System events</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-chart-1" />
              Priority Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-1">{priorityNotifications.length}</div>
            <div className="text-sm text-muted-foreground">High/Medium priority</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-chart-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {analyticsLoading ? "…" : `${analytics?.summary.system_health_pct ?? 0}%`}
            </div>
            <div className="text-sm text-muted-foreground">
              {analyticsLoading
                ? " "
                : (analytics?.summary.system_health_pct ?? 0) >= 95
                  ? "All systems optimal"
                  : (analytics?.summary.system_health_pct ?? 0) >= 85
                    ? "Healthy with minor issues"
                    : "Attention recommended"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
          <CardDescription>Latest system events and alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            recentNotifications.map((n) => (
              <NotificationCard key={n.id} notification={n} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            All Notifications
          </CardTitle>
          <CardDescription>Complete notification history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} />
            ))
          )}
        </CardContent>
      </Card>

    </div>
  );
}
