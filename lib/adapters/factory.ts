import { DeviceAdapter, DeviceRecord, ProviderType } from './types';
import { SimulatedAdapter } from './simulated';
import { TeslaAdapter } from './providers/tesla';
import { EnphaseAdapter } from './providers/enphase';
import { HomeAssistantAdapter } from './providers/home-assistant';
import { SolarEdgeAdapter } from './providers/solaredge';
import { EmporiaAdapter } from './providers/emporia';
import type { SolarArrayConfig } from '@/lib/simulation/solar';
import type { BatteryDeviceConfig } from '@/lib/simulation/battery';
import type { EvDeviceConfig } from '@/lib/simulation/ev';

/**
 * Cross-device context passed to the SimulatedAdapter so battery/EV/grid
 * status reflects the full system (e.g., available solar surplus). Real
 * provider adapters ignore it because the upstream API already has full
 * site context.
 */
export interface AdapterContext {
  solar?: SolarArrayConfig[];
  ev?: EvDeviceConfig[];
  battery?: BatteryDeviceConfig | null;
}

export function createAdapter(
  device: DeviceRecord,
  context?: AdapterContext
): DeviceAdapter {
  const providerType: ProviderType = device.provider_type ?? 'simulated';

  switch (providerType) {
    case 'tesla':
      return new TeslaAdapter(device);
    case 'enphase':
      return new EnphaseAdapter(device);
    case 'home_assistant':
      return new HomeAssistantAdapter(device);
    case 'solaredge':
      return new SolarEdgeAdapter(device);
    case 'emporia':
      return new EmporiaAdapter(device);
    case 'simulated':
    default:
      return new SimulatedAdapter(device, context);
  }
}

export function getAllProviderSchemas() {
  const mockDevice: DeviceRecord = {
    id: '',
    user_id: '',
    name: '',
    type: 'solar_array',
    is_active: true,
    provider_type: 'simulated',
    connection_config: {},
  };

  return [
    new SimulatedAdapter(mockDevice).getConnectionSchema(),
    new TeslaAdapter({ ...mockDevice, provider_type: 'tesla' }).getConnectionSchema(),
    new EnphaseAdapter({ ...mockDevice, provider_type: 'enphase' }).getConnectionSchema(),
    new HomeAssistantAdapter({ ...mockDevice, provider_type: 'home_assistant' }).getConnectionSchema(),
    new SolarEdgeAdapter({ ...mockDevice, provider_type: 'solaredge' }).getConnectionSchema(),
    new EmporiaAdapter({ ...mockDevice, provider_type: 'emporia' }).getConnectionSchema(),
  ];
}
