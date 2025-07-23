"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2 } from "lucide-react";

type DeviceType = 'solar_array' | 'battery' | 'ev' | 'grid' | 'house';

interface AddDeviceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deviceType: DeviceType | null;
  existingDevices?: { type: DeviceType; name: string }[];
  onDeviceAdded?: () => void;
  editingDevice?: {
    id: string;
    name: string;
    type: DeviceType;
    config?: any;
  } | null;
}

interface FormData {
  // Common fields
  name: string;
  
  // Solar array specific
  panel_count?: number;
  output_per_panel_kw?: number;
  
  // Battery specific
  capacity_kwh?: number;
  max_flow_kw?: number;
  
  // EV specific
  battery_capacity_kwh?: number;
  target_charge?: number;
  departure_time?: string;
  charger_power_kw?: number;
}

type DialogStep = 'form' | 'connecting' | 'connected';

export function AddDeviceDialog({ isOpen, onClose, deviceType, existingDevices = [], onDeviceAdded, editingDevice }: AddDeviceDialogProps) {
  const [step, setStep] = useState<DialogStep>('form');
  const [formData, setFormData] = useState<FormData>({ name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(0);

  // Generate auto-filled device name
  const generateDeviceName = (type: DeviceType): string => {
    const typeNames = {
      'solar_array': 'Solar Array',
      'battery': 'Battery',
      'ev': 'Electric Vehicle',
      'grid': 'Electrical Grid',
      'house': 'House Monitor'
    };
    
    // Grid and House don't get numbers since there's only one of each
    if (type === 'grid' || type === 'house') {
      return typeNames[type];
    }
    
    const existingOfType = existingDevices.filter(d => d.type === type);
    const nextNumber = existingOfType.length + 1;
    
    return `${typeNames[type]} ${nextNumber}`;
  };

  // Auto-fill device name when dialog opens or pre-populate for editing
  useEffect(() => {
    if (isOpen && deviceType) {
      if (editingDevice) {
        // Pre-populate form with existing device data
        const configData = { ...editingDevice.config };
        
        // Handle departure_time formatting for HTML time input (HH:MM format)
        if (configData.departure_time && deviceType === 'ev') {
          // Convert time with timezone to HH:MM format
          const timeStr = configData.departure_time;
          if (timeStr.includes('T')) {
            // If it's a full datetime, extract time part
            configData.departure_time = timeStr.split('T')[1].substring(0, 5);
          } else if (timeStr.includes('+') || timeStr.includes('-')) {
            // If it's time with timezone, extract just the HH:MM part
            configData.departure_time = timeStr.substring(0, 5);
          }
        }
        
        setFormData({
          name: editingDevice.name,
          ...configData
        });
      } else {
        // Generate new device name for adding
        setFormData({ name: generateDeviceName(deviceType) });
      }
    }
  }, [isOpen, deviceType, editingDevice]);

  const handleClose = () => {
    setStep('form');
    setFormData({ name: '' });
    setConnectionProgress(0);
    onClose();
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = (): boolean => {
    if (!formData.name.trim()) return false;
    
    switch (deviceType) {
      case 'solar_array':
        return !!(formData.panel_count && formData.output_per_panel_kw);
      case 'battery':
        return !!(formData.capacity_kwh && formData.max_flow_kw);
      case 'ev':
        return !!(formData.battery_capacity_kwh && formData.target_charge && 
                 formData.departure_time && formData.charger_power_kw);
      case 'grid':
      case 'house':
        return true; // Just name is required
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    
    setStep('connecting');
    setConnectionProgress(0);
    
    // Simulate hardware connection with progress
    const interval = setInterval(() => {
      setConnectionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep('connected'), 500);
          return 100;
        }
        return prev + 5; // 2 seconds total (100/20 * 100ms)
      });
    }, 100);
  };

  const handleFinish = async () => {
    try {
      const isEditing = !!editingDevice;
      const url = isEditing 
        ? `/api/configuration/devices/${editingDevice.id}`
        : '/api/configuration/devices';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, type: deviceType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to ${isEditing ? 'update' : 'add'} device:`, errorData.error);
        // Could show error feedback here
        return;
      }

      // Success - refresh the devices list
      onDeviceAdded?.();
      handleClose();
    } catch (error) {
      console.error(`Error ${editingDevice ? 'updating' : 'adding'} device:`, error);
      // Could show error feedback here
    }
  };

  const getDeviceTitle = () => {
    const prefix = editingDevice ? 'Edit' : 'Add';
    const connectPrefix = editingDevice ? 'Edit' : 'Connect to';
    
    switch (deviceType) {
      case 'solar_array': return `${prefix} Solar Array`;
      case 'battery': return `${prefix} Battery`;
      case 'ev': return `${prefix} Electric Vehicle`;
      case 'grid': return `${connectPrefix} Grid`;
      case 'house': return `${connectPrefix} House`;
      default: return `${prefix} Device`;
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      {/* Common Name Field */}
      <div>
        <Label htmlFor="name">
          {deviceType === 'grid' || deviceType === 'house' ? 'Connection Name' : 'Device Name'}
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder={
            deviceType === 'solar_array' ? 'Roof Solar Array' :
            deviceType === 'battery' ? 'Tesla Powerwall' :
            deviceType === 'ev' ? 'Tesla Model 3' :
            deviceType === 'grid' ? 'Main Grid Connection' :
            deviceType === 'house' ? 'House Load Monitor' : 'Device Name'
          }
        />
      </div>

      {/* Solar Array Fields */}
      {deviceType === 'solar_array' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="panel_count">Number of Panels</Label>
              <Input
                id="panel_count"
                type="number"
                min="1"
                value={formData.panel_count || ''}
                onChange={(e) => handleInputChange('panel_count', parseInt(e.target.value) || 0)}
                placeholder="24"
              />
            </div>
            <div>
              <Label htmlFor="output_per_panel_kw">Output per Panel (kW)</Label>
              <Input
                id="output_per_panel_kw"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.output_per_panel_kw || ''}
                onChange={(e) => handleInputChange('output_per_panel_kw', parseFloat(e.target.value) || 0)}
                placeholder="0.4"
              />
            </div>
          </div>
        </>
      )}

      {/* Battery Fields */}
      {deviceType === 'battery' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity_kwh">Capacity (kWh)</Label>
              <Input
                id="capacity_kwh"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.capacity_kwh || ''}
                onChange={(e) => handleInputChange('capacity_kwh', parseFloat(e.target.value) || 0)}
                placeholder="13.5"
              />
            </div>
            <div>
              <Label htmlFor="max_flow_kw">Max Power Flow (kW)</Label>
              <Input
                id="max_flow_kw"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.max_flow_kw || ''}
                onChange={(e) => handleInputChange('max_flow_kw', parseFloat(e.target.value) || 0)}
                placeholder="5.0"
              />
            </div>
          </div>
        </>
      )}

      {/* EV Fields */}
      {deviceType === 'ev' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="battery_capacity_kwh">Battery Capacity (kWh)</Label>
              <Input
                id="battery_capacity_kwh"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.battery_capacity_kwh || ''}
                onChange={(e) => handleInputChange('battery_capacity_kwh', parseFloat(e.target.value) || 0)}
                placeholder="75"
              />
            </div>
            <div>
              <Label htmlFor="target_charge">Target Charge (%)</Label>
              <Input
                id="target_charge"
                type="number"
                min="1"
                max="100"
                value={formData.target_charge || ''}
                onChange={(e) => handleInputChange('target_charge', parseInt(e.target.value) || 0)}
                placeholder="80"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="departure_time">Departure Time</Label>
              <Input
                id="departure_time"
                type="time"
                value={formData.departure_time || ''}
                onChange={(e) => handleInputChange('departure_time', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="charger_power_kw">Charger Power (kW)</Label>
              <Input
                id="charger_power_kw"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.charger_power_kw || ''}
                onChange={(e) => handleInputChange('charger_power_kw', parseFloat(e.target.value) || 0)}
                placeholder="11.5"
              />
            </div>
          </div>
        </>
      )}

      {/* Grid/House just need the name field */}
      {(deviceType === 'grid' || deviceType === 'house') && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {deviceType === 'grid' 
              ? 'This will establish a connection to your electrical grid for energy monitoring.'
              : 'This will enable monitoring of your house energy consumption.'
            }
          </p>
        </div>
      )}
    </div>
  );

  const renderConnecting = () => (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connecting to Hardware</h3>
        <p className="text-muted-foreground">
          Establishing connection with {formData.name}...
        </p>
      </div>
      
      <div className="space-y-2">
        <Progress value={connectionProgress} className="w-full" />
        <p className="text-center text-sm text-muted-foreground">
          {connectionProgress}%
        </p>
      </div>
    </div>
  );

  const renderConnected = () => (
    <div className="space-y-6 py-8 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
      <div>
        <h3 className="text-lg font-semibold mb-2">Successfully Connected!</h3>
        <p className="text-muted-foreground">
          {formData.name} has been connected and configured.
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDeviceTitle()}</DialogTitle>
        </DialogHeader>

        {step === 'form' && renderForm()}
        {step === 'connecting' && renderConnecting()}
        {step === 'connected' && renderConnected()}

        <div className="flex justify-between pt-4">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isFormValid()}>
                {editingDevice ? 'Save Changes' : `Add ${deviceType === 'grid' || deviceType === 'house' ? 'Connection' : 'Device'}`}
              </Button>
            </>
          )}
          
          {step === 'connecting' && (
            <Button variant="outline" onClick={handleClose} className="mx-auto">
              Cancel
            </Button>
          )}
          
          {step === 'connected' && (
            <Button onClick={handleFinish} className="mx-auto">
              Finish
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 