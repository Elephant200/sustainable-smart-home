import { DeviceAdapter, DeviceRecord, ProviderType } from './types';
import { SimulatedAdapter } from './simulated';
import { TeslaAdapter } from './providers/tesla';
import { EnphaseAdapter } from './providers/enphase';
import { HomeAssistantAdapter } from './providers/home-assistant';
import { SolarEdgeAdapter } from './providers/solaredge';
import { EmporiaAdapter } from './providers/emporia';

export function createAdapter(device: DeviceRecord): DeviceAdapter {
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
      return new SimulatedAdapter(device);
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
