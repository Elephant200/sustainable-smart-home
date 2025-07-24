import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Activity, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { CarbonIntensityChart } from "@/components/visualizations/carbon-intensity-chart";
import { HouseLoadChart } from "@/components/visualizations/house-load-chart";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Real-time energy monitoring and control for your sustainable smart home
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* House Energy Load Chart */}
      <HouseLoadChart />
      
      {/* Carbon Intensity Chart */}
      <CarbonIntensityChart />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Energy Overview
            </CardTitle>
            <CardDescription>Real-time energy consumption</CardDescription>
            <CardAction>
              <Badge variant="outline">Live</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Additional energy metrics and controls will be displayed here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Status
            </CardTitle>
            <CardDescription>Current system health</CardDescription>
            <CardAction>
              <Badge variant="default">Online</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              System health monitoring will be implemented here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common settings and controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full">
                Optimize Settings
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                View Reports
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
