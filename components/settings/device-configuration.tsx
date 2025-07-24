"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { Plus, Battery, Sun, Car, Zap, Home, Edit, Trash2 } from "lucide-react";
import { AddDeviceDialog } from "./add-device-dialog";

// Device type interfaces based on database schema
interface Device {
  id: string;
  name: string;
  type: 'solar_array' | 'battery' | 'ev' | 'grid' | 'house';
  updated_at: string;
}

interface SolarDevice extends Device {
  type: 'solar_array';
  config: {
    panel_count: number;
    output_per_panel_kw: number;
  };
}

interface BatteryDevice extends Device {
  type: 'battery';
  config: {
    capacity_kwh: number;
    max_flow_kw: number;
  };
}

interface EVDevice extends Device {
  type: 'ev';
  config: {
    battery_capacity_kwh: number;
    target_charge: number;
    departure_time: string;
    charger_power_kw: number;
  };
}

interface GridDevice extends Device {
  type: 'grid';
}

interface HouseDevice extends Device {
  type: 'house';
}

type DeviceWithConfig = SolarDevice | BatteryDevice | EVDevice | GridDevice | HouseDevice;

interface DeviceConfigurationProps {
  // Optional initial devices - will be fetched from API if not provided
  initialDevices?: DeviceWithConfig[];
}

export function DeviceConfiguration({ initialDevices = [] }: DeviceConfigurationProps) {
  const [devices, setDevices] = useState<DeviceWithConfig[]>(initialDevices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<'solar_array' | 'battery' | 'ev' | 'grid' | 'house' | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceWithConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceWithConfig | null>(null);

  // Fetch devices from API
  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/configuration/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices);
      } else {
        console.error('Failed to fetch devices');
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  // Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Group devices by type
  const solarDevices = devices.filter(d => d.type === 'solar_array') as SolarDevice[];
  const batteryDevices = devices.filter(d => d.type === 'battery') as BatteryDevice[];
  const evDevices = devices.filter(d => d.type === 'ev') as EVDevice[];
  const gridDevices = devices.filter(d => d.type === 'grid') as GridDevice[];
  const houseDevices = devices.filter(d => d.type === 'house') as HouseDevice[];

  // Calculate summary stats
  const totalSolarOutput = solarDevices.reduce((total, device) => 
    total + (device.config.panel_count * device.config.output_per_panel_kw), 0
  );
  const totalBatteryCapacity = batteryDevices.reduce((total, device) => 
    total + device.config.capacity_kwh, 0
  );
  const totalBatteryMaxFlow = batteryDevices.reduce((total, device) => 
    total + device.config.max_flow_kw, 0
  );

  const handleAddDevice = (deviceType: 'solar_array' | 'battery' | 'ev' | 'grid' | 'house') => {
    setSelectedDeviceType(deviceType);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDeviceType(null);
    setEditingDevice(null);
  };

  const handleEditDevice = (device: DeviceWithConfig) => {
    setEditingDevice(device);
    setSelectedDeviceType(device.type);
    setDialogOpen(true);
  };

  const handleDeleteDevice = (device: DeviceWithConfig) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deviceToDelete) return;

    try {
      const response = await fetch(`/api/configuration/devices/${deviceToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh devices list
        fetchDevices();
        setDeleteDialogOpen(false);
        setDeviceToDelete(null);
      } else {
        console.error('Failed to delete device');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setDeviceToDelete(null);
  };

  const DeviceCard = ({ device }: { device: DeviceWithConfig }) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            {device.type === 'solar_array' && <Sun className="h-4 w-4 text-orange-500" />}
            {device.type === 'battery' && <Battery className="h-4 w-4 text-green-500" />}
            {device.type === 'ev' && <Car className="h-4 w-4 text-blue-500" />}
            {device.type === 'grid' && <Zap className="h-4 w-4 text-yellow-500" />}
            {device.type === 'house' && <Home className="h-4 w-4 text-purple-500" />}
          </div>
          <div>
            <h4 className="font-medium">{device.name}</h4>
            <div className="text-sm text-muted-foreground">
              {device.type === 'solar_array' && (device as SolarDevice).config && (
                `${(device as SolarDevice).config.panel_count} panels • ${(device as SolarDevice).config.output_per_panel_kw} kW each`
              )}
              {device.type === 'battery' && (device as BatteryDevice).config && (
                `${(device as BatteryDevice).config.capacity_kwh} kWh • ${(device as BatteryDevice).config.max_flow_kw} kW max`
              )}
              {device.type === 'ev' && (device as EVDevice).config && (
                `${(device as EVDevice).config.battery_capacity_kwh} kWh • ${(device as EVDevice).config.target_charge}% target • Departs ${(device as EVDevice).config.departure_time?.substring(0, 5) || 'N/A'}`
              )}
              {(device.type === 'grid' || device.type === 'house') && 'Connected'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditDevice(device)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteDevice(device)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Solar Arrays Section */}
      <section id="solar-arrays" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sun className="h-5 w-5 text-orange-500" />
              Solar Arrays
            </h3>
            {totalSolarOutput > 0 && (
              <p className="text-sm text-muted-foreground">
                Total Output: {totalSolarOutput.toFixed(1)} kW
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => handleAddDevice('solar_array')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Solar Array
          </Button>
        </div>
        
        <div className="space-y-3">
          {solarDevices.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No solar arrays configured</p>
            </Card>
          ) : (
            solarDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

      {/* Batteries Section */}
      <section id="batteries" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Battery className="h-5 w-5 text-green-500" />
              Batteries
            </h3>
            {totalBatteryCapacity > 0 && (
              <p className="text-sm text-muted-foreground">
                Total Capacity: {totalBatteryCapacity.toFixed(1)} kWh • Max Flow: {totalBatteryMaxFlow.toFixed(1)} kW
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => handleAddDevice('battery')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Battery
          </Button>
        </div>
        
        <div className="space-y-3">
          {batteryDevices.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No batteries configured</p>
            </Card>
          ) : (
            batteryDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

      {/* EVs Section */}
      <section id="electric-vehicles" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-500" />
              Electric Vehicles
            </h3>
            {evDevices.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {evDevices.length} vehicle{evDevices.length !== 1 ? 's' : ''} configured
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => handleAddDevice('ev')}>
            <Plus className="h-4 w-4 mr-2" />
            Add EV
          </Button>
        </div>
        
        <div className="space-y-3">
          {evDevices.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No electric vehicles configured</p>
            </Card>
          ) : (
            evDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

      {/* Grid Section */}
      <section id="grid-connection" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Grid Connection
            </h3>
            <p className="text-sm text-muted-foreground">
              {gridDevices.length > 0 ? 'Connected to electrical grid' : 'No grid connection'}
            </p>
          </div>
          {gridDevices.length === 0 && (
            <Button variant="outline" onClick={() => handleAddDevice('grid')}>
              <Plus className="h-4 w-4 mr-2" />
              Connect to Grid
            </Button>
          )}
        </div>
        
        <div className="space-y-3">
          {gridDevices.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No grid connection configured</p>
            </Card>
          ) : (
            gridDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

      {/* House Section */}
      <section id="house-monitor" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Home className="h-5 w-5 text-purple-500" />
              House Monitor
            </h3>
            <p className="text-sm text-muted-foreground">
              {houseDevices.length > 0 ? 'House energy monitoring active' : 'No house monitoring'}
            </p>
          </div>
          {houseDevices.length === 0 && (
            <Button variant="outline" onClick={() => handleAddDevice('house')}>
              <Plus className="h-4 w-4 mr-2" />
              Connect House
            </Button>
          )}
        </div>
        
        <div className="space-y-3">
          {houseDevices.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No house monitoring configured</p>
            </Card>
          ) : (
            houseDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

      {/* Add/Edit Device Dialog */}
      <AddDeviceDialog
        isOpen={dialogOpen}
        onClose={handleCloseDialog}
        deviceType={selectedDeviceType}
        existingDevices={devices.map(d => ({ type: d.type, name: d.name }))}
        onDeviceAdded={fetchDevices}
        editingDevice={editingDevice}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deviceToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 