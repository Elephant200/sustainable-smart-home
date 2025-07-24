import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sun, TrendingUp, CloudSun, Battery } from "lucide-react";
import type { Metadata } from "next";
import { SolarGenerationChart } from "@/components/visualizations/solar-generation-chart";

export const metadata: Metadata = {
  title: "Solar Power",
};

export default function SolarPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solar Power</CardTitle>
          <CardDescription>
            Monitor your solar panel performance and energy generation in real-time
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* Solar Generation Chart */}
      <SolarGenerationChart />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Current Generation
            </CardTitle>
            <CardDescription>Real-time solar power output</CardDescription>
            <CardAction>
              <Badge variant="default">Generating</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Real-time solar generation metrics will be displayed here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Panel Performance
            </CardTitle>
            <CardDescription>Individual panel efficiency</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">View Details</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Individual panel performance metrics will be displayed here
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-4 w-4" />
              Weather Impact
            </CardTitle>
            <CardDescription>How weather affects generation</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Weather impact analysis will be implemented here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-4 w-4" />
              Energy Storage
            </CardTitle>
            <CardDescription>Solar to battery efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Energy storage metrics will be implemented here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 