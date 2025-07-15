export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-2">Analytics Page</h2>
        <p className="text-muted-foreground">
          This is the Analytics skeleton page. Energy usage analytics and sustainability metrics will be implemented here.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Energy Usage Trends</h3>
          <p className="text-sm text-muted-foreground">Historical consumption patterns</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Cost Analysis</h3>
          <p className="text-sm text-muted-foreground">Energy cost breakdown and savings</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Carbon Footprint</h3>
          <p className="text-sm text-muted-foreground">Environmental impact metrics</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Efficiency Reports</h3>
          <p className="text-sm text-muted-foreground">System performance insights</p>
        </div>
      </div>
    </div>
  );
} 