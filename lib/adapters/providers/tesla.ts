/**
 * Tesla Fleet API Adapter (Stub)
 *
 * Real API reference: https://developer.tesla.com/docs/fleet-api
 *
 * Auth: OAuth2 PKCE flow
 *   - Authorization URL: https://auth.tesla.com/oauth2/v3/authorize
 *   - Token URL:         https://auth.tesla.com/oauth2/v3/token
 *   - Scopes required:   energy_device_data, vehicle_device_data, openid, offline_access
 *
 * Key endpoints when live:
 *   GET /api/1/energy_sites/:site_id/live_status
 *     -> solar_power (W), battery_power (W), load_power (W), grid_power (W), percentage_charged
 *   GET /api/1/energy_sites/:site_id/history?kind=power&period=day
 *     -> time_series[]: { timestamp, solar_power, battery_power, consumer_energy_imported_from_solar }
 *   GET /api/1/vehicles/:vehicle_id/vehicle_data
 *     -> charge_state: { battery_level, charge_rate, charging_state }
 *
 * connection_config shape:
 *   { access_token: string; refresh_token: string; site_id: string; vehicle_id?: string }
 */

import {
  DeviceAdapter,
  DeviceCommand,
  DeviceRecord,
  DeviceStatus,
  HistoricalPoint,
  HistoryRange,
  ConnectionSchema,
  hasStoredCredentials,
} from '../types';
import { SimulatedAdapter } from '../simulated';

export class TeslaAdapter implements DeviceAdapter {
  readonly providerType = 'tesla' as const;
  private device: DeviceRecord;
  private fallback: SimulatedAdapter;

  constructor(device: DeviceRecord) {
    this.device = device;
    this.fallback = new SimulatedAdapter(device);
  }

  isConfigured(): boolean {
    return hasStoredCredentials(this.device.connection_config, [
      'access_token',
      'site_id',
    ]);
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) {
      const simStatus = await this.fallback.getStatus();
      return { ...simStatus, providerType: 'tesla', isLive: false };
    }

    /**
     * LIVE IMPLEMENTATION (fill in when credentials are set):
     *
     * const cfg = this.device.connection_config as { access_token: string; site_id: string };
     * const res = await fetch(
     *   `https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/energy_sites/${cfg.site_id}/live_status`,
     *   { headers: { Authorization: `Bearer ${cfg.access_token}` } }
     * );
     * const json = await res.json();
     * const d = json.response;
     * return {
     *   deviceId: this.device.id,
     *   providerType: 'tesla',
     *   timestamp: new Date(),
     *   isLive: true,
     *   solarOutputKw:      (d.solar_power ?? 0) / 1000,
     *   batterySOCPercent:  d.percentage_charged,
     *   batteryPowerKw:     (d.battery_power ?? 0) / 1000,
     *   houseLoadKw:        (d.load_power ?? 0) / 1000,
     *   gridImportKw:       (d.grid_power ?? 0) / 1000,
     * };
     */

    const simStatus = await this.fallback.getStatus();
    return { ...simStatus, providerType: 'tesla', isLive: false };
  }

  async getHistory(range: HistoryRange): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) {
      return this.fallback.getHistory(range);
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as { access_token: string; site_id: string };
     * const res = await fetch(
     *   `https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/energy_sites/${cfg.site_id}/history` +
     *   `?kind=power&period=day&start_date=${range.startDate.toISOString()}&end_date=${range.endDate.toISOString()}`,
     *   { headers: { Authorization: `Bearer ${cfg.access_token}` } }
     * );
     * const json = await res.json();
     * return json.response.time_series.map((pt: { timestamp: string; solar_power?: number }) => ({
     *   timestamp: new Date(pt.timestamp),
     *   value: (pt.solar_power ?? 0) / 1000,
     *   unit: 'kW',
     * }));
     */

    return this.fallback.getHistory(range);
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Tesla credentials not configured' };
    }

    /**
     * LIVE IMPLEMENTATION:
     * Tesla does not yet expose a public write API for Powerwall charge settings
     * via the Fleet API for third-party apps. Monitor https://developer.tesla.com
     * for updates. Vehicle charge limit can be set via:
     *   POST /api/1/vehicles/:vehicle_id/command/set_charge_limit
     *   body: { percent: number }
     */

    return {
      success: false,
      message: 'Tesla write commands not yet available in Fleet API for third-party apps',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'tesla',
      displayName: 'Tesla (Powerwall + EV)',
      description:
        'Connect Tesla Powerwall battery storage and Tesla vehicles via the Tesla Fleet API.',
      authMethod: 'oauth2_pkce',
      fields: [
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'Paste your Tesla Fleet API access token',
          required: true,
          helpText:
            'Obtain via OAuth2 PKCE flow at https://auth.tesla.com. Requires energy_device_data scope.',
        },
        {
          key: 'refresh_token',
          label: 'Refresh Token',
          type: 'password',
          placeholder: 'Paste your Tesla Fleet API refresh token',
          required: true,
          helpText: 'Used to automatically renew the access token.',
        },
        {
          key: 'site_id',
          label: 'Energy Site ID',
          type: 'text',
          placeholder: 'e.g. 1234567890',
          required: true,
          helpText:
            'Find your site_id via GET /api/1/products after authenticating.',
        },
        {
          key: 'vehicle_id',
          label: 'Vehicle ID (optional)',
          type: 'text',
          placeholder: 'e.g. 1234567890',
          required: false,
          helpText:
            'Required only for EV charge state monitoring. Find via GET /api/1/vehicles.',
        },
      ],
      setupInstructions:
        'Register your app at https://developer.tesla.com, complete the OAuth2 PKCE flow to get tokens, then find your site_id via the /products endpoint.',
    };
  }
}
