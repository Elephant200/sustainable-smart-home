import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Leaf, BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Insights</CardTitle>
          <CardDescription>
            Comprehensive energy usage analytics and sustainability metrics for data-driven decisions
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Energy Usage Trends
            </CardTitle>
            <CardDescription>Historical consumption patterns</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">View Details</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Historical energy consumption trends and pattern analysis will be shown here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Analysis
            </CardTitle>
            <CardDescription>Energy cost breakdown and savings</CardDescription>
            <CardAction>
              <Badge variant="default">$234 Saved</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Detailed cost breakdown and savings analytics will be displayed here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              Carbon Footprint
            </CardTitle>
            <CardDescription>Environmental impact metrics</CardDescription>
            <CardAction>
              <Badge variant="secondary">-45% CO₂</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Environmental impact tracking and carbon footprint reduction metrics will be shown here
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Efficiency Reports
            </CardTitle>
            <CardDescription>System performance insights</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">Generate Report</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              System efficiency analysis and performance optimization insights will be available here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 