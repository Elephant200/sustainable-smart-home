import {
  DeviceAdapter,
  DeviceCommand,
  DeviceRecord,
  DeviceStatus,
  HistoricalPoint,
  ConnectionSchema,
} from './types';
import {
  generateSolarData,
  generateHouseLoadData,
  DeviceConfig,
} from '@/lib/data-generator/client-generators';

export class SimulatedAdapter implements DeviceAdapter {
  readonly providerType = 'simulated' as const;
  private device: DeviceRecord;

  constructor(device: DeviceRecord) {
    this.device = device;
  }

  isConfigured(): boolean {
    return true;
  }

  async getStatus(): Promise<DeviceStatus> {
    const now = new Date();
    const status: DeviceStatus = {
      deviceId: this.device.id,
      providerType: 'simulated',
      timestamp: now,
      isLive: false,
    };

    switch (this.device.type) {
      case 'solar_array': {
        const cfg = this.device.solar_config;
        if (cfg) {
          const devCfg: DeviceConfig = {
            id: this.device.id,
            name: this.device.name,
            type: 'solar_array',
            is_active: true,
            solar_config: cfg,
          };
          const points = generateSolarData(
            new Date(now.getTime() - 60 * 60 * 1000),
            now,
            [devCfg]
          );
          const latest = points[points.length - 1];
          status.solarOutputKw = latest?.total_generation_kwh ?? 0;
        }
        break;
      }
      case 'battery': {
        status.batterySOCPercent = 50 + 20 * Math.sin(now.getTime() / 3600000);
        const cap = this.device.battery_config?.capacity_kwh ?? 10;
        status.batterySOCKwh = (status.batterySOCPercent / 100) * cap;
        status.batteryPowerKw = 1.5 * Math.sin(now.getTime() / 1800000);
        break;
      }
      case 'ev': {
        status.evSOCPercent = 60;
        status.evPluggedIn = true;
        status.evChargeRateKw = 7.4;
        break;
      }
      case 'house': {
        const loadPt = generateHouseLoadData(
          new Date(now.getTime() - 60 * 60 * 1000),
          now
        );
        status.houseLoadKw = loadPt[loadPt.length - 1]?.energy_kwh ?? 2.0;
        break;
      }
      case 'grid': {
        status.gridImportKw = 0.5;
        status.gridCarbonIntensity = 250;
        break;
      }
    }

    return status;
  }

  async getHistory(
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPoint[]> {
    switch (this.device.type) {
      case 'solar_array': {
        const cfg = this.device.solar_config;
        if (!cfg) return [];
        const devCfg: DeviceConfig = {
          id: this.device.id,
          name: this.device.name,
          type: 'solar_array',
          is_active: true,
          solar_config: cfg,
        };
        const raw = generateSolarData(startDate, endDate, [devCfg]);
        return raw.map((pt) => ({
          timestamp: new Date(pt.timestamp),
          value: pt.total_generation_kwh,
          unit: 'kWh',
        }));
      }
      case 'house': {
        const raw = generateHouseLoadData(startDate, endDate);
        return raw.map((pt) => ({
          timestamp: new Date(pt.timestamp),
          value: pt.energy_kwh,
          unit: 'kWh',
        }));
      }
      default:
        return [];
    }
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: true,
      message: `[Simulated] Command '${command.type}' acknowledged`,
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'simulated',
      displayName: 'Simulated (Demo)',
      description:
        'Uses built-in physics-based simulation. No real hardware required.',
      authMethod: 'none',
      fields: [],
    };
  }
}
