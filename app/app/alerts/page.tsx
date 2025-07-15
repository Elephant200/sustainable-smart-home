import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Settings, Clock, Phone } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Notifications</CardTitle>
          <CardDescription>
            Monitor system notifications, configure alert preferences, and manage emergency contacts
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Recent Alerts
            </CardTitle>
            <CardDescription>Latest system notifications</CardDescription>
            <CardAction>
              <Badge variant="outline">3 New</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Recent system alerts and notifications will be displayed here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Alert Settings
            </CardTitle>
            <CardDescription>Configure notification preferences</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Configure</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Notification preferences and alert configuration will be available here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Alert History
            </CardTitle>
            <CardDescription>Historical alert log</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">View Archive</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Historical alert logs and system event tracking will be shown here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Emergency Contacts
            </CardTitle>
            <CardDescription>Critical alert notifications</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Manage Contacts</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Emergency contact management for critical system alerts will be available here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 