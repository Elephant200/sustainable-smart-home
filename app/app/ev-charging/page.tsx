import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Calendar, Zap, DollarSign } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Charging",
};

export default function EVChargingPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>EV Charging</CardTitle>
          <CardDescription>
            Manage your electric vehicle charging with smart scheduling and cost optimization
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Charging Status
            </CardTitle>
            <CardDescription>Current vehicle charging state</CardDescription>
            <CardAction>
              <Badge variant="default">Connected</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Real-time EV charging status and progress will be displayed here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Management
            </CardTitle>
            <CardDescription>Smart charging schedule</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Edit Schedule</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Smart charging schedule configuration will be available here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Energy Source
            </CardTitle>
            <CardDescription>Solar vs grid power usage</CardDescription>
            <CardAction>
              <Badge variant="secondary">Solar</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Energy source optimization and tracking will be shown here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Optimization
            </CardTitle>
            <CardDescription>Charging cost analysis</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">View Report</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cost analysis and optimization recommendations will be displayed here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 