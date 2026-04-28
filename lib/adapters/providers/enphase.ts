/**
 * Enphase Enlighten API Adapter (Stub)
 *
 * Real API reference: https://developer-v4.enphase.com/docs.html
 *
 * Auth: OAuth2 (authorization code flow)
 *   - Authorization URL: https://api.enphaseenergy.com/oauth/authorize
 *   - Token URL:         https://api.enphaseenergy.com/oauth/token
 *   - Scopes required:   (per app registration)
 *
 * Key endpoints when live:
 *   GET /api/v4/systems/:system_id/summary
 *     -> current_power (W), energy_today (Wh), last_report_at
 *   GET /api/v4/systems/:system_id/telemetry/production_micro
 *     -> intervals[]: { end_at, powr (W), enwh (Wh) }
 *   GET /api/v4/systems/:system_id/devices/batteries
 *     -> devices[]: { serial_num, charge_status, charge_level_pct }
 *
 * connection_config shape:
 *   { api_key: string; access_token: string; system_id: string }
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

export class EnphaseAdapter implements DeviceAdapter {
  readonly providerType = 'enphase' as const;
  private device: DeviceRecord;
  private fallback: SimulatedAdapter;

  constructor(device: DeviceRecord) {
    this.device = device;
    this.fallback = new SimulatedAdapter(device);
  }

  isConfigured(): boolean {
    const cfg = this.device.connection_config as {
      api_key?: string;
      access_token?: string;
      system_id?: string;
    };
    return !!(cfg.api_key && cfg.access_token && cfg.system_id);
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) {
      const simStatus = await this.fallback.getStatus();
      return { ...simStatus, providerType: 'enphase', isLive: false };
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as { api_key: string; access_token: string; system_id: string };
     * const res = await fetch(
     *   `https://api.enphaseenergy.com/api/v4/systems/${cfg.system_id}/summary?key=${cfg.api_key}`,
     *   { headers: { Authorization: `Bearer ${cfg.access_token}` } }
     * );
     * const d = await res.json();
     * return {
     *   deviceId: this.device.id,
     *   providerType: 'enphase',
     *   timestamp: new Date(d.last_report_at * 1000),
     *   isLive: true,
     *   solarOutputKw: (d.current_power ?? 0) / 1000,
     * };
     */

    const simStatus = await this.fallback.getStatus();
    return { ...simStatus, providerType: 'enphase', isLive: false };
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
     * const cfg = this.device.connection_config as { api_key: string; access_token: string; system_id: string };
     * const start_at = Math.floor(startDate.getTime() / 1000);
     * const end_at   = Math.floor(endDate.getTime() / 1000);
     * const res = await fetch(
     *   `https://api.enphaseenergy.com/api/v4/systems/${cfg.system_id}/telemetry/production_micro` +
     *   `?key=${cfg.api_key}&start_at=${start_at}&granularity=day`,
     *   { headers: { Authorization: `Bearer ${cfg.access_token}` } }
     * );
     * const json = await res.json();
     * return json.intervals.map((pt: { end_at: number; enwh: number }) => ({
     *   timestamp: new Date(pt.end_at * 1000),
     *   value: pt.enwh / 1000,
     *   unit: 'kWh',
     * }));
     */

    return this.fallback.getHistory(metric, startDate, endDate);
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: 'Enphase Enlighten API is read-only; control commands are not supported',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'enphase',
      displayName: 'Enphase (Solar + IQ Battery)',
      description:
        'Connect Enphase microinverter solar arrays and IQ Battery storage via the Enlighten API v4.',
      authMethod: 'oauth2',
      fields: [
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password',
          placeholder: 'Your Enphase app API key',
          required: true,
          helpText:
            'Create an app at https://developer-v4.enphase.com to obtain an API key.',
        },
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'OAuth2 access token',
          required: true,
          helpText:
            'Obtained via OAuth2 authorization code flow. See https://developer-v4.enphase.com/docs.html.',
        },
        {
          key: 'system_id',
          label: 'System ID',
          type: 'text',
          placeholder: 'e.g. 123456',
          required: true,
          helpText:
            'Your Enphase system ID, visible in the Enlighten Manager URL or via GET /api/v4/systems.',
        },
      ],
      setupInstructions:
        'Register at https://developer-v4.enphase.com, complete OAuth2 to get tokens, then retrieve your system_id via /api/v4/systems.',
    };
  }
}
