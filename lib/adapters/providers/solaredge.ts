/**
 * SolarEdge Monitoring API Adapter (Stub)
 *
 * Real API reference: https://developers.solaredge.com/solaredge-dev-site/apis
 *
 * Auth: API key (query parameter or header)
 *
 * Key endpoints when live:
 *   GET /site/:site_id/currentPowerFlow?api_key=:key
 *     -> siteCurrentPowerFlow: { PV: { status, currentPower }, LOAD: { currentPower }, GRID: { currentPower }, STORAGE: { status, chargeLevel, currentPower } }
 *   GET /site/:site_id/energy?timeUnit=HOUR&startDate=:start&endDate=:end&api_key=:key
 *     -> energy.values[]: { date, value (Wh) }
 *   GET /site/:site_id/storageData?startTime=:start&endTime=:end&api_key=:key
 *     -> storageData.batteries[0].telemetries[]: { timeStamp, batteryPercentageState, power }
 *
 * connection_config shape:
 *   { api_key: string; site_id: string }
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

export class SolarEdgeAdapter implements DeviceAdapter {
  readonly providerType = 'solaredge' as const;
  private device: DeviceRecord;
  private fallback: SimulatedAdapter;

  constructor(device: DeviceRecord) {
    this.device = device;
    this.fallback = new SimulatedAdapter(device);
  }

  isConfigured(): boolean {
    return hasStoredCredentials(this.device.connection_config, [
      'api_key',
      'site_id',
    ]);
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) {
      const simStatus = await this.fallback.getStatus();
      return { ...simStatus, providerType: 'solaredge', isLive: false };
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as { api_key: string; site_id: string };
     * const res = await fetch(
     *   `https://monitoringapi.solaredge.com/site/${cfg.site_id}/currentPowerFlow?api_key=${cfg.api_key}`
     * );
     * const json = await res.json();
     * const flow = json.siteCurrentPowerFlow;
     * return {
     *   deviceId: this.device.id,
     *   providerType: 'solaredge',
     *   timestamp: new Date(),
     *   isLive: true,
     *   solarOutputKw:    flow.PV?.currentPower ?? 0,
     *   houseLoadKw:      flow.LOAD?.currentPower ?? 0,
     *   gridImportKw:     flow.GRID?.currentPower ?? 0,
     *   batterySOCPercent: flow.STORAGE?.chargeLevel ?? 0,
     *   batteryPowerKw:    flow.STORAGE?.currentPower ?? 0,
     * };
     */

    const simStatus = await this.fallback.getStatus();
    return { ...simStatus, providerType: 'solaredge', isLive: false };
  }

  async getHistory(range: HistoryRange): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) {
      return this.fallback.getHistory(range);
    }

    /**
     * LIVE IMPLEMENTATION:
     *
     * const cfg = this.device.connection_config as { api_key: string; site_id: string };
     * const fmt = (d: Date) => d.toISOString().split('T')[0];
     * const res = await fetch(
     *   `https://monitoringapi.solaredge.com/site/${cfg.site_id}/energy` +
     *   `?timeUnit=HOUR&startDate=${fmt(range.startDate)}&endDate=${fmt(range.endDate)}&api_key=${cfg.api_key}`
     * );
     * const json = await res.json();
     * return json.energy.values
     *   .filter((pt: { date: string; value: number | null }) => pt.value !== null)
     *   .map((pt: { date: string; value: number }) => ({
     *     timestamp: new Date(pt.date),
     *     value: pt.value / 1000,
     *     unit: 'kWh',
     *   }));
     */

    return this.fallback.getHistory(range);
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: 'SolarEdge Monitoring API is read-only; control commands are not supported',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'solaredge',
      displayName: 'SolarEdge',
      description:
        'Connect SolarEdge solar inverters and StorEdge battery systems via the SolarEdge Monitoring API.',
      authMethod: 'api_key',
      fields: [
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password',
          placeholder: 'Your SolarEdge API key',
          required: true,
          helpText:
            'Find in the SolarEdge monitoring portal: Admin → Site Access → API Access.',
        },
        {
          key: 'site_id',
          label: 'Site ID',
          type: 'text',
          placeholder: 'e.g. 12345',
          required: true,
          helpText:
            'Your site ID is visible in the SolarEdge monitoring portal URL: /monitoring/site/:site_id/dashboard.',
        },
      ],
      setupInstructions:
        'Log in to https://monitoring.solaredge.com, navigate to Admin → Site Access, and enable API access to retrieve your API key and site ID.',
    };
  }
}
