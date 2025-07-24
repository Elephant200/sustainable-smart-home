import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Settings, Clock, Car, Battery, Sun, Zap, DollarSign, AlertTriangle, CheckCircle, Info, TrendingUp, Shield, Cloud } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alerts",
};

// Fake notifications based on the system data from other pages
const notifications = [
  {
    id: 1,
    type: "info",
    category: "EV Charging",
    title: "BMW i4 Charging at Reduced Rate",
    message: "BMW i4 charging rate reduced to 3.6 kW as battery approaches 50% capacity. Estimated completion: 4:15 PM.",
    time: "2 minutes ago",
    icon: Car,
    priority: "medium",
    status: "active"
  },
  {
    id: 2,
    type: "success",
    category: "Solar",
    title: "Peak Solar Generation Achieved",
    message: "Solar panels reached peak output of 4.9 kW at 12:34 PM. Daily generation on track for 290+ kWh.",
    time: "1 hour ago",
    icon: Sun,
    priority: "low",
    status: "resolved"
  },
  {
    id: 3,
    type: "info",
    category: "Battery",
    title: "Battery Charging from Solar",
    message: "Battery storage charging at 2.5 kW from excess solar generation. Current charge: 87%.",
    time: "2 hours ago",
    icon: Battery,
    priority: "low",
    status: "active"
  },
  {
    id: 4,
    type: "success",
    category: "Cost Savings",
    title: "Daily Savings Target Exceeded",
    message: "Today's energy savings of $66.57 exceed the daily target of $60. Monthly savings: $1,847.",
    time: "3 hours ago",
    icon: DollarSign,
    priority: "low",
    status: "resolved"
  },
  {
    id: 5,
    type: "success",
    category: "EV Charging",
    title: "Tesla Model 3 Charging Complete",
    message: "Tesla Model 3 reached 78% charge (234 mi range) at 6:23 AM. Total energy used: 52.3 kWh. Cost: $4.18.",
    time: "8 hours ago",
    icon: Car,
    priority: "medium",
    status: "resolved"
  },
  {
    id: 6,
    type: "info",
    category: "System",
    title: "Smart Charging Optimization Active",
    message: "EV charging scheduled during off-peak hours (10 PM - 6 AM). Estimated savings: $12.50 vs peak rates.",
    time: "10 hours ago",
    icon: Zap,
    priority: "low",
    status: "resolved"
  },
  {
    id: 7,
    type: "info",
    category: "EV Charging",
    title: "BMW i4 Charging Started",
    message: "BMW i4 connected and charging at 7.2 kW. Current charge: 45%. Estimated full charge: 3:15 hours.",
    time: "15 hours ago",
    icon: Car,
    priority: "medium",
    status: "resolved"
  },
  {
    id: 8,
    type: "info",
    category: "EV Charging",
    title: "Tesla Model 3 Charging Started",
    message: "Tesla Model 3 connected and charging at 11.5 kW. Scheduled completion: 6:30 AM.",
    time: "16 hours ago",
    icon: Car,
    priority: "medium",
    status: "resolved"
  },
  {
    id: 9,
    type: "warning",
    category: "Weather",
    title: "Partly Cloudy Conditions",
    message: "Cloud cover may reduce solar generation by 15-20% this afternoon. Battery storage will compensate.",
    time: "18 hours ago",
    icon: Cloud,
    priority: "low",
    status: "active"
  },
  {
    id: 10,
    type: "success",
    category: "Battery",
    title: "Battery Discharge Complete",
    message: "Battery finished overnight discharge cycle. Energy provided: 45.2 kWh. Efficiency: 96.8%.",
    time: "20 hours ago",
    icon: Battery,
    priority: "low",
    status: "resolved"
  },
  {
    id: 11,
    type: "info",
    category: "System",
    title: "Grid Independence Milestone",
    message: "System achieved 73% grid independence this month, exceeding the 70% target. Next goal: 80%.",
    time: "1 day ago",
    icon: TrendingUp,
    priority: "medium",
    status: "resolved"
  },
  {
    id: 12,
    type: "warning",
    category: "Maintenance",
    title: "Solar Panel Cleaning Recommended",
    message: "Panel #8 efficiency dropped to 87%. Consider cleaning to restore optimal performance.",
    time: "2 days ago",
    icon: Sun,
    priority: "medium",
    status: "active"
  }
];

function NotificationCard({ notification }: { notification: typeof notifications[0] }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "text-green-600 bg-green-50 border-green-200";
      case "warning": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "error": return "text-red-600 bg-red-50 border-red-200";
      case "info": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return CheckCircle;
      case "warning": return AlertTriangle;
      case "error": return AlertTriangle;
      case "info": return Info;
      default: return Bell;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge variant="destructive">High</Badge>;
      case "medium": return <Badge variant="default" className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium</Badge>;
      case "low": return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">Normal</Badge>;
    }
  };

  const TypeIcon = getTypeIcon(notification.type);
  const CategoryIcon = notification.icon;

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
          <span className="text-xs text-muted-foreground">{notification.time}</span>
          {notification.status === "active" && (
            <Button variant="outline" size="sm">Dismiss</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const activeNotifications = notifications.filter(n => n.status === "active");
  const recentNotifications = notifications.slice(0, 5);
  const priorityNotifications = notifications.filter(n => n.priority === "high" || n.priority === "medium");

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{activeNotifications.length}</div>
            <div className="text-sm text-muted-foreground">Require attention</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-500" />
              Today&apos;s Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">8</div>
            <div className="text-sm text-muted-foreground">System events</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Priority Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{priorityNotifications.length}</div>
            <div className="text-sm text-muted-foreground">High/Medium priority</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">98%</div>
            <div className="text-sm text-muted-foreground">All systems optimal</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
          <CardDescription>Latest system events and alerts</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm">Mark All Read</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentNotifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </CardContent>
      </Card>

      {/* All Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            All Notifications
          </CardTitle>
          <CardDescription>Complete notification history</CardDescription>
          <CardAction>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Filter</Button>
              <Button variant="outline" size="sm">Export</Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </CardContent>
      </Card>

      {/* Quick Settings Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage your alert settings and emergency contacts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Configure Notification Settings</p>
              <p className="text-xs text-muted-foreground">Customize which alerts you receive and how you&apos;re notified</p>
            </div>
            <Button variant="outline" size="sm">
              Go to Settings
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Alert Types:</span>
              <span className="font-semibold">5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emergency Contacts:</span>
              <span className="font-semibold">3</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 