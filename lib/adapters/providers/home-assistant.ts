/**
 * Home Assistant REST API Adapter (Stub)
 *
 * Real API reference: https://developers.home-assistant.io/docs/api/rest
 *
 * Auth: Long-lived access token (Bearer)
 *   - Create in HA profile page: Settings → Profile → Long-Lived Access Tokens
 *
 * Key endpoints when live:
 *   GET  /api/states/:entity_id
 *     -> state (string), attributes (object), last_updated
 *   GET  /api/history/period/:start?filter_entity_id=:entity_id&end_time=:end
 *     -> [[{ state, last_updated }]]
 *   POST /api/services/:domain/:service
 *     -> triggers a Home Assistant service (e.g. number.set_value for charge limit)
 *
 * Entity mapping convention used by this adapter:
 *   solar_array  → sensor.solar_power           (W or kW; auto-detected)
 *   battery      → sensor.battery_soc, sensor.battery_power
 *   ev           → sensor.ev_battery_level, switch.ev_charger
 *   house        → sensor.house_power
 *   grid         → sensor.grid_power
 *
 * The entity IDs are configurable per device via connection_config.
 *
 * connection_config shape:
 *   { base_url: string; token: string; entity_id: string; power_unit?: 'W' | 'kW' }
 */

import {
  DeviceAdapter,
  DeviceCommand,
  DeviceRecord,
  DeviceStatus,
  HistoricalPoint,
  ConnectionSchema,
} from '../types';
import { SimulatedAdapter } from '../simulated';

interface HaConnectionConfig {
  base_url?: string;
  token?: string;
  entity_id?: string;
  power_unit?: 'W' | 'kW';
}

export class HomeAssistantAdapter implements DeviceAdapter {
  readonly providerType = 'home_assistant' as const;
  private device: DeviceRecord;
  private fallback: SimulatedAdapter;

  constructor(device: DeviceRecord) {
    this.device = device;
    this.fallback = new SimulatedAdapter(device);
  }

  isConfigured(): boolean {
    const cfg = this.device.connection_config as HaConnectionConfig;
    return !!(cfg.base_url && cfg.token && cfg.entity_id);
  }

  private toKw(value: number, unit: string): number {
    const cfg = this.device.connection_config as HaConnectionConfig;
    const unitOverride = cfg.power_unit ?? unit;
    return unitOverride === 'W' ? value / 1000 : value;
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) {
      const simStatus = await this.fallback.getStatus();
      return { ...simStatus, providerType: 'home_assistant', isLive: false };
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as HaConnectionConfig;
     * const res = await fetch(`${cfg.base_url}/api/states/${cfg.entity_id}`, {
     *   headers: { Authorization: `Bearer ${cfg.token}` },
     * });
     * const entity = await res.json();
     * const raw = parseFloat(entity.state);
     * const unit = entity.attributes?.unit_of_measurement ?? 'kW';
     * const kw = this.toKw(isNaN(raw) ? 0 : raw, unit);
     *
     * const status: DeviceStatus = {
     *   deviceId: this.device.id,
     *   providerType: 'home_assistant',
     *   timestamp: new Date(entity.last_updated),
     *   isLive: true,
     * };
     *
     * switch (this.device.type) {
     *   case 'solar_array': status.solarOutputKw = kw; break;
     *   case 'battery':     status.batterySOCPercent = raw; break;
     *   case 'house':       status.houseLoadKw = kw; break;
     *   case 'grid':        status.gridImportKw = kw; break;
     *   case 'ev':          status.evSOCPercent = raw; break;
     * }
     * return status;
     */

    const simStatus = await this.fallback.getStatus();
    return { ...simStatus, providerType: 'home_assistant', isLive: false };
  }

  async getHistory(
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) {
      return this.fallback.getHistory(metric, startDate, endDate);
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as HaConnectionConfig;
     * const start = startDate.toISOString();
     * const end   = endDate.toISOString();
     * const url = `${cfg.base_url}/api/history/period/${start}` +
     *             `?filter_entity_id=${cfg.entity_id}&end_time=${end}&minimal_response=true`;
     * const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
     * const json: [[{ state: string; last_updated: string }]] = await res.json();
     * const series = json[0] ?? [];
     * return series.map(pt => ({
     *   timestamp: new Date(pt.last_updated),
     *   value: parseFloat(pt.state) || 0,
     *   unit: 'kW',
     * }));
     */

    return this.fallback.getHistory(metric, startDate, endDate);
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Home Assistant credentials not configured' };
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as HaConnectionConfig;
     * // Example: trigger a script or set a number entity
     * const res = await fetch(`${cfg.base_url}/api/services/number/set_value`, {
     *   method: 'POST',
     *   headers: {
     *     Authorization: `Bearer ${cfg.token}`,
     *     'Content-Type': 'application/json',
     *   },
     *   body: JSON.stringify({ entity_id: cfg.entity_id, value: command.payload.value }),
     * });
     * return { success: res.ok };
     */

    return {
      success: false,
      message: 'Home Assistant credentials not configured',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'home_assistant',
      displayName: 'Home Assistant',
      description:
        'Connect any device supported by Home Assistant (Zigbee, Z-Wave, Matter, and more) via the local REST API.',
      authMethod: 'local_token',
      fields: [
        {
          key: 'base_url',
          label: 'Home Assistant URL',
          type: 'url',
          placeholder: 'http://homeassistant.local:8123',
          required: true,
          helpText:
            'The local network URL of your Home Assistant instance. Must be accessible from this device.',
        },
        {
          key: 'token',
          label: 'Long-Lived Access Token',
          type: 'password',
          placeholder: 'Paste your long-lived access token',
          required: true,
          helpText:
            'Generate in HA: Settings → Profile → Long-Lived Access Tokens.',
        },
        {
          key: 'entity_id',
          label: 'Entity ID',
          type: 'text',
          placeholder: 'sensor.solar_power',
          required: true,
          helpText:
            'The HA entity that reports this device\'s data (e.g. sensor.solar_power, sensor.battery_soc). Find in Settings → Devices & Services.',
        },
        {
          key: 'power_unit',
          label: 'Unit of Measurement',
          type: 'select',
          required: false,
          options: [
            { label: 'kW (kilowatts)', value: 'kW' },
            { label: 'W (watts)', value: 'W' },
          ],
          helpText:
            'The unit your entity reports in. Auto-detected from HA where possible.',
        },
      ],
      setupInstructions:
        'Enable the Home Assistant REST API (enabled by default). Create a Long-Lived Access Token in your profile, then find the entity_id for this device in Settings → Devices & Services.',
    };
  }
}
