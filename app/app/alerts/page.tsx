export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-2">Alerts Page</h2>
        <p className="text-muted-foreground">
          This is the Alerts skeleton page. System notifications and alerts will be implemented here.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Recent Alerts</h3>
          <p className="text-sm text-muted-foreground">Latest system notifications</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Alert Settings</h3>
          <p className="text-sm text-muted-foreground">Configure notification preferences</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Alert History</h3>
          <p className="text-sm text-muted-foreground">Historical alert log</p>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-2">Emergency Contacts</h3>
          <p className="text-sm text-muted-foreground">Critical alert notifications</p>
        </div>
      </div>
    </div>
  );
} 