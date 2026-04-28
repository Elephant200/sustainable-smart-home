"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { getAllProviderSchemas } from "@/lib/adapters/factory";
import { ProviderType, ConnectionSchema, ConnectionFieldSchema } from "@/lib/adapters/types";

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
    config?: Record<string, unknown>;
    provider_type?: string;
    connection_config?: Record<string, unknown>;
  } | null;
}

interface FormData {
  name: string;
  panel_count?: number;
  output_per_panel_kw?: number;
  capacity_kwh?: number;
  max_flow_kw?: number;
  battery_capacity_kwh?: number;
  target_charge?: number;
  departure_time?: string;
  charger_power_kw?: number;
}

type DialogStep = 'form' | 'connecting' | 'connected';

const providerSchemas = getAllProviderSchemas();

export function AddDeviceDialog({
  isOpen,
  onClose,
  deviceType,
  existingDevices = [],
  onDeviceAdded,
  editingDevice,
}: AddDeviceDialogProps) {
  const [step, setStep] = useState<DialogStep>('form');
  const [formData, setFormData] = useState<FormData>({ name: '' });
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('simulated');
  const [connectionConfig, setConnectionConfig] = useState<Record<string, string>>({});
  const [showProviderFields, setShowProviderFields] = useState(false);

  const activeSchema: ConnectionSchema =
    providerSchemas.find((s) => s.providerType === selectedProvider) ?? providerSchemas[0];

  useEffect(() => {
    if (isOpen && deviceType) {
      if (editingDevice) {
        const configData = { ...editingDevice.config };
        if (
          configData.departure_time &&
          deviceType === 'ev' &&
          typeof configData.departure_time === 'string'
        ) {
          const timeStr = configData.departure_time;
          if (timeStr.includes('T')) {
            configData.departure_time = timeStr.split('T')[1].substring(0, 5);
          } else if (timeStr.includes('+') || timeStr.includes('-')) {
            configData.departure_time = timeStr.substring(0, 5);
          }
        }
        setFormData({ name: editingDevice.name, ...configData });
        setSelectedProvider((editingDevice.provider_type as ProviderType) ?? 'simulated');
        setConnectionConfig((editingDevice.connection_config as Record<string, string>) ?? {});
      } else {
        const generateName = (type: DeviceType): string => {
          const typeNames: Record<DeviceType, string> = {
            solar_array: 'Solar Array',
            battery: 'Battery',
            ev: 'Electric Vehicle',
            grid: 'Electrical Grid',
            house: 'House Monitor',
          };
          if (type === 'grid' || type === 'house') return typeNames[type];
          const existingOfType = existingDevices.filter((d) => d.type === type);
          return `${typeNames[type]} ${existingOfType.length + 1}`;
        };
        setFormData({ name: generateName(deviceType) });
        setSelectedProvider('simulated');
        setConnectionConfig({});
        setShowProviderFields(false);
      }
    }
  }, [isOpen, deviceType, editingDevice, existingDevices]);

  const handleClose = () => {
    setStep('form');
    setFormData({ name: '' });
    setConnectionProgress(0);
    setSelectedProvider('simulated');
    setConnectionConfig({});
    setShowProviderFields(false);
    onClose();
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleConnectionFieldChange = (key: string, value: string) => {
    setConnectionConfig((prev) => ({ ...prev, [key]: value }));
  };

  const isFormValid = (): boolean => {
    if (!formData.name.trim()) return false;
    switch (deviceType) {
      case 'solar_array':
        return !!(formData.panel_count && formData.output_per_panel_kw);
      case 'battery':
        return !!(formData.capacity_kwh && formData.max_flow_kw);
      case 'ev':
        return !!(
          formData.battery_capacity_kwh &&
          formData.target_charge &&
          formData.departure_time &&
          formData.charger_power_kw
        );
      case 'grid':
      case 'house':
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    setStep('connecting');
    setConnectionProgress(0);

    const interval = setInterval(() => {
      setConnectionProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep('connected'), 500);
          return 100;
        }
        return prev + 5;
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
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          type: deviceType,
          provider_type: selectedProvider,
          connection_config: connectionConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to ${isEditing ? 'update' : 'add'} device:`, errorData.error);
        return;
      }

      onDeviceAdded?.();
      handleClose();
    } catch (error) {
      console.error(`Error ${editingDevice ? 'updating' : 'adding'} device:`, error);
    }
  };

  const getDeviceTitle = () => {
    const prefix = editingDevice ? 'Edit' : 'Add';
    const connectPrefix = editingDevice ? 'Edit' : 'Connect to';
    switch (deviceType) {
      case 'solar_array': return `${prefix} Solar Array`;
      case 'battery':     return `${prefix} Battery`;
      case 'ev':          return `${prefix} Electric Vehicle`;
      case 'grid':        return `${connectPrefix} Grid`;
      case 'house':       return `${connectPrefix} House`;
      default:            return `${prefix} Device`;
    }
  };

  const renderProviderField = (field: ConnectionFieldSchema) => {
    const value = connectionConfig[field.key] ?? '';
    const inputType = field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text';

    return (
      <div key={field.key}>
        <Label htmlFor={`conn_${field.key}`}>
          {field.label}
          {!field.required && (
            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
          )}
        </Label>
        {field.type === 'select' ? (
          <Select
            value={value}
            onValueChange={(v) => handleConnectionFieldChange(field.key, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={`conn_${field.key}`}
            type={inputType}
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => handleConnectionFieldChange(field.key, e.target.value)}
            autoComplete={field.type === 'password' ? 'new-password' : undefined}
          />
        )}
        {field.helpText && (
          <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
        )}
      </div>
    );
  };

  const renderForm = () => (
    <div className="space-y-4">
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
            deviceType === 'battery'     ? 'Tesla Powerwall' :
            deviceType === 'ev'          ? 'Tesla Model 3' :
            deviceType === 'grid'        ? 'Main Grid Connection' :
            deviceType === 'house'       ? 'House Load Monitor' : 'Device Name'
          }
        />
      </div>

      {deviceType === 'solar_array' && (
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
      )}

      {deviceType === 'battery' && (
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
      )}

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

      {(deviceType === 'grid' || deviceType === 'house') && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {deviceType === 'grid'
              ? 'This will establish a connection to your electrical grid for energy monitoring.'
              : 'This will enable monitoring of your house energy consumption.'}
          </p>
        </div>
      )}

      {/* Data Source / Provider Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowProviderFields((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Data Source
            <span className="text-muted-foreground font-normal">
              — {activeSchema.displayName}
            </span>
          </span>
          {showProviderFields ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showProviderFields && (
          <div className="p-4 space-y-4 border-t">
            <div>
              <Label htmlFor="provider_type">Connection Type</Label>
              <Select
                value={selectedProvider}
                onValueChange={(v) => {
                  setSelectedProvider(v as ProviderType);
                  setConnectionConfig({});
                }}
              >
                <SelectTrigger id="provider_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerSchemas.map((schema) => (
                    <SelectItem key={schema.providerType} value={schema.providerType}>
                      {schema.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {activeSchema.description}
              </p>
            </div>

            {activeSchema.fields.length > 0 && (
              <div className="space-y-3">
                {activeSchema.fields.map(renderProviderField)}
              </div>
            )}

            {activeSchema.setupInstructions && selectedProvider !== 'simulated' && (
              <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium">Setup: </span>
                  {activeSchema.setupInstructions}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderConnecting = () => (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {selectedProvider === 'simulated' ? 'Configuring Device' : 'Connecting to Hardware'}
        </h3>
        <p className="text-muted-foreground">
          {selectedProvider === 'simulated'
            ? `Setting up ${formData.name} with simulated data...`
            : `Establishing connection with ${formData.name} via ${providerSchemas.find((s) => s.providerType === selectedProvider)?.displayName}...`}
        </p>
      </div>
      <div className="space-y-2">
        <Progress value={connectionProgress} className="w-full" />
        <p className="text-center text-sm text-muted-foreground">{connectionProgress}%</p>
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
          {selectedProvider !== 'simulated' && (
            <span className="block text-sm mt-1 text-muted-foreground">
              Using{' '}
              {providerSchemas.find((s) => s.providerType === selectedProvider)?.displayName}.
              Live data will activate once credentials are verified.
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                {editingDevice
                  ? 'Save Changes'
                  : `Add ${deviceType === 'grid' || deviceType === 'house' ? 'Connection' : 'Device'}`}
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
