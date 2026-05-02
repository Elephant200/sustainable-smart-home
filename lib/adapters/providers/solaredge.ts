/**
 * SolarEdge Monitoring API Adapter
 *
 * Real API reference: https://developers.solaredge.com/solaredge-dev-site/apis
 *
 * Auth: API key (query parameter)
 *
 * Endpoints used:
 *   GET /site/:site_id/currentPowerFlow?api_key=:key
 *     -> siteCurrentPowerFlow: { unit, PV: { currentPower }, LOAD: { currentPower },
 *        GRID: { currentPower }, STORAGE: { status, chargeLevel, currentPower } }
 *   GET /site/:site_id/energy?timeUnit=HOUR&startDate=:start&endDate=:end&api_key=:key
 *     -> energy.values[]: { date, value (Wh) }
 *   GET /site/:site_id/storageData?startTime=:start&endTime=:end&api_key=:key
 *     -> storageData.batteries[].telemetries[]: { timeStamp, batteryPercentageState, power }
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

interface SeConnectionConfig {
  api_key?: string;
  site_id?: string;
}

interface CurrentPowerFlow {
  unit?: string;
  PV?: { currentPower?: number };
  LOAD?: { currentPower?: number };
  GRID?: { currentPower?: number; status?: string };
  STORAGE?: { chargeLevel?: number; currentPower?: number; status?: string };
}

const REQUEST_TIMEOUT_MS = 10_000;
const BASE = 'https://monitoringapi.solaredge.com';

async function seFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtDateTime(d: Date): string {
  // SolarEdge expects: YYYY-MM-DD HH:mm:ss in site-local time. We use UTC
  // here; for sub-hour data the API still returns aligned points.
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * SolarEdge currentPowerFlow returns powers in the unit indicated by the
 * `unit` field (kW, MW, or W). Convert everything to kW.
 */
function toKw(value: number, unit?: string): number {
  switch ((unit ?? 'kW').toUpperCase()) {
    case 'W':
      return value / 1000;
    case 'MW':
      return value * 1000;
    case 'KW':
    default:
      return value;
  }
}

export class SolarEdgeAdapter implements DeviceAdapter {
  readonly providerType = 'solaredge' as const;
  private device: DeviceRecord;

  constructor(device: DeviceRecord) {
    this.device = device;
  }

  isConfigured(): boolean {
    return hasStoredCredentials(this.device.connection_config, [
      'api_key',
      'site_id',
    ]);
  }

  private cfg(): { api_key: string; site_id: string } {
    const c = this.device.connection_config as SeConnectionConfig;
    return { api_key: c.api_key ?? '', site_id: c.site_id ?? '' };
  }

  /**
   * Returns an "unavailable" status with no data fields populated when a
   * live SolarEdge call fails. Real-provider devices MUST NEVER fall back
   * to simulator output; routes / UI surface `isLive=false` and the
   * `error` reason so users see the outage instead of a fabricated value.
   */
  private unavailableStatus(reason: string): DeviceStatus {
    if (reason)
      console.warn(
        `[solaredge] ${this.device.name}: live data unavailable — ${reason}`
      );
    return {
      deviceId: this.device.id,
      providerType: 'solaredge',
      timestamp: new Date(),
      isLive: false,
      error: reason || 'SolarEdge credentials not configured',
    };
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) return this.unavailableStatus('');
    const cfg = this.cfg();
    try {
      const url = `${BASE}/site/${encodeURIComponent(cfg.site_id)}/currentPowerFlow?api_key=${encodeURIComponent(cfg.api_key)}`;
      const res = await seFetch(url);
      if (!res.ok)
        return this.unavailableStatus(`currentPowerFlow HTTP ${res.status}`);
      const json = (await res.json()) as { siteCurrentPowerFlow?: CurrentPowerFlow };
      const flow = json.siteCurrentPowerFlow ?? {};
      const unit = flow.unit;

      const status: DeviceStatus = {
        deviceId: this.device.id,
        providerType: 'solaredge',
        timestamp: new Date(),
        isLive: true,
      };

      switch (this.device.type) {
        case 'solar_array':
          status.solarOutputKw = toKw(flow.PV?.currentPower ?? 0, unit);
          break;
        case 'battery': {
          const socPct = flow.STORAGE?.chargeLevel ?? 0;
          // SolarEdge convention: positive = discharging, negative = charging.
          // Our DeviceStatus convention: positive = charging.
          const rawPower = toKw(flow.STORAGE?.currentPower ?? 0, unit);
          const status_text = (flow.STORAGE?.status ?? '').toLowerCase();
          const signedPower =
            status_text === 'discharging' ? -Math.abs(rawPower) :
            status_text === 'charging' ? Math.abs(rawPower) : -rawPower;
          status.batterySOCPercent = socPct;
          status.batteryPowerKw = signedPower;
          if (this.device.battery_config) {
            status.batteryCapacityKwh = this.device.battery_config.capacity_kwh;
            status.batteryMaxFlowKw = this.device.battery_config.max_flow_kw;
            status.batterySOCKwh =
              (socPct / 100) * this.device.battery_config.capacity_kwh;
          }
          break;
        }
        case 'house':
          status.houseLoadKw = toKw(flow.LOAD?.currentPower ?? 0, unit);
          break;
        case 'grid':
          status.gridImportKw = toKw(flow.GRID?.currentPower ?? 0, unit);
          // SolarEdge currentPowerFlow includes LOAD alongside GRID; surface
          // it as houseLoadKwSystem so dashboard routes that rely on the
          // grid adapter for whole-home load (snapshot route) get a real
          // value when only a SolarEdge grid device is configured.
          if (typeof flow.LOAD?.currentPower === 'number') {
            status.houseLoadKwSystem = toKw(flow.LOAD.currentPower, unit);
          }
          break;
      }
      return status;
    } catch (err) {
      return this.unavailableStatus(
        err instanceof Error ? err.message : 'unknown network error'
      );
    }
  }

  async getHistory(range: HistoryRange): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) return [];
    const cfg = this.cfg();

    try {
      // For batteries, hit storageData (SoC + power telemetry).
      if (this.device.type === 'battery') {
        const url =
          `${BASE}/site/${encodeURIComponent(cfg.site_id)}/storageData` +
          `?startTime=${encodeURIComponent(fmtDateTime(range.startDate))}` +
          `&endTime=${encodeURIComponent(fmtDateTime(range.endDate))}` +
          `&api_key=${encodeURIComponent(cfg.api_key)}`;
        const res = await seFetch(url);
        if (!res.ok) {
          console.warn(
            `[solaredge] ${this.device.name}: storageData HTTP ${res.status}; returning empty`
          );
          return [];
        }
        const json = (await res.json()) as {
          storageData?: {
            batteries?: Array<{
              telemetries?: Array<{
                timeStamp: string;
                batteryPercentageState?: number;
                power?: number;
              }>;
            }>;
          };
        };
        const tel = json.storageData?.batteries?.[0]?.telemetries ?? [];
        const capacityKwh = this.device.battery_config?.capacity_kwh ?? 0;
        return tel.map((pt) => {
          const value =
            range.metric === 'soc_kwh'
              ? ((pt.batteryPercentageState ?? 0) / 100) * capacityKwh
              : range.metric === 'power_kw'
                ? -(pt.power ?? 0) / 1000 // SE returns W, sign-flip for our convention
                : pt.batteryPercentageState ?? 0;
          return {
            timestamp: new Date(pt.timeStamp + 'Z'),
            value,
            unit:
              range.metric === 'power_kw'
                ? 'kW'
                : range.metric === 'soc_kwh'
                  ? 'kWh'
                  : '%',
          };
        });
      }

      // Power-shaped metrics on non-battery devices: use /powerDetails which
      // returns instantaneous power per timestep (W) split by meter type.
      // Returning the /energy series (kWh) for a power_kw caller would
      // mislabel kWh as kW and corrupt analytics, so honor the requested
      // metric here and return [] for combinations SolarEdge can't answer.
      const isPowerMetric =
        range.metric === 'power_kw' ||
        range.metric === 'grid_kw' ||
        range.metric === 'charge_kw';
      if (isPowerMetric) {
        // Map device.type → which meter(s) to request and how to combine.
        let meters: string;
        if (this.device.type === 'solar_array') meters = 'PRODUCTION';
        else if (this.device.type === 'house') meters = 'CONSUMPTION';
        else if (this.device.type === 'grid') meters = 'PURCHASED,FEEDIN';
        else return []; // unsupported pairing — never fabricate

        const url =
          `${BASE}/site/${encodeURIComponent(cfg.site_id)}/powerDetails` +
          `?startTime=${encodeURIComponent(fmtDateTime(range.startDate))}` +
          `&endTime=${encodeURIComponent(fmtDateTime(range.endDate))}` +
          `&meters=${meters}` +
          `&api_key=${encodeURIComponent(cfg.api_key)}`;
        const res = await seFetch(url);
        if (!res.ok) {
          console.warn(
            `[solaredge] ${this.device.name}: powerDetails HTTP ${res.status}; returning empty`
          );
          return [];
        }
        const json = (await res.json()) as {
          powerDetails?: {
            unit?: string;
            meters?: Array<{
              type: string;
              values?: Array<{ date: string; value?: number | null }>;
            }>;
          };
        };
        const apiUnit = json.powerDetails?.unit ?? 'W';
        const findMeter = (type: string) =>
          json.powerDetails?.meters?.find((m) => m.type === type)?.values ?? [];

        if (this.device.type === 'grid') {
          // Signed grid: positive = importing, negative = exporting.
          const purchased = findMeter('PURCHASED');
          const feedin = findMeter('FEEDIN');
          const feedinByTs = new Map(
            feedin.map((v) => [v.date, v.value ?? 0])
          );
          return purchased
            .filter((v) => v.value != null)
            .map((v) => ({
              timestamp: new Date(v.date.replace(' ', 'T') + 'Z'),
              value: toKw(
                (v.value ?? 0) - (feedinByTs.get(v.date) ?? 0),
                apiUnit
              ),
              unit: 'kW',
            }));
        }

        const meterType =
          this.device.type === 'solar_array' ? 'PRODUCTION' : 'CONSUMPTION';
        const values = findMeter(meterType);
        return values
          .filter((v) => v.value != null)
          .map((v) => ({
            timestamp: new Date(v.date.replace(' ', 'T') + 'Z'),
            value: toKw(v.value as number, apiUnit),
            unit: 'kW',
          }));
      }

      // Energy metric. SolarEdge exposes two distinct energy series:
      //   - /site/:id/energy:        site-wide PRODUCTION kWh per hour.
      //                              Correct only for solar_array.
      //   - /site/:id/energyDetails: per-meter (PRODUCTION / CONSUMPTION /
      //                              PURCHASED / FEEDIN / SELFCONSUMPTION)
      //                              kWh per timestep. Required for house
      //                              (CONSUMPTION) and grid (PURCHASED -
      //                              FEEDIN) historical energy, which the
      //                              flows / analytics / backup-runtime
      //                              routes depend on. Returning [] for
      //                              house/grid here previously collapsed
      //                              those routes to zero for SolarEdge.
      if (range.metric !== 'energy_kwh') {
        return [];
      }
      if (this.device.type === 'solar_array') {
        const url =
          `${BASE}/site/${encodeURIComponent(cfg.site_id)}/energy` +
          `?timeUnit=HOUR&startDate=${fmtDate(range.startDate)}&endDate=${fmtDate(range.endDate)}` +
          `&api_key=${encodeURIComponent(cfg.api_key)}`;
        const res = await seFetch(url);
        if (!res.ok) {
          console.warn(
            `[solaredge] ${this.device.name}: energy HTTP ${res.status}; returning empty`
          );
          return [];
        }
        const json = (await res.json()) as {
          energy?: {
            unit?: string;
            values?: Array<{ date: string; value: number | null }>;
          };
        };
        const values = json.energy?.values ?? [];
        const apiUnit = (json.energy?.unit ?? 'Wh').toUpperCase();
        const toKwh = (v: number) =>
          apiUnit === 'WH' ? v / 1000 : apiUnit === 'MWH' ? v * 1000 : v;
        return values
          .filter((pt) => pt.value !== null)
          .map((pt) => ({
            // SolarEdge returns "YYYY-MM-DD HH:mm:ss" in site-local time;
            // treat as UTC for consistent bucketing.
            timestamp: new Date(pt.date.replace(' ', 'T') + 'Z'),
            value: toKwh(pt.value as number),
            unit: 'kWh',
          }));
      }

      // House / grid energy: use /energyDetails with the appropriate meter
      // set. This endpoint returns per-timestep kWh per meter — additive
      // within a bucket via bucketSumEnergy upstream, which matches the
      // contract for `energy_kwh` series (no integration required).
      if (this.device.type !== 'house' && this.device.type !== 'grid') {
        return [];
      }
      const meters =
        this.device.type === 'house' ? 'CONSUMPTION' : 'PURCHASED,FEEDIN';
      const url =
        `${BASE}/site/${encodeURIComponent(cfg.site_id)}/energyDetails` +
        `?startTime=${encodeURIComponent(fmtDateTime(range.startDate))}` +
        `&endTime=${encodeURIComponent(fmtDateTime(range.endDate))}` +
        `&timeUnit=HOUR&meters=${meters}` +
        `&api_key=${encodeURIComponent(cfg.api_key)}`;
      const res = await seFetch(url);
      if (!res.ok) {
        console.warn(
          `[solaredge] ${this.device.name}: energyDetails HTTP ${res.status}; returning empty`
        );
        return [];
      }
      const json = (await res.json()) as {
        energyDetails?: {
          unit?: string;
          meters?: Array<{
            type: string;
            values?: Array<{ date: string; value?: number | null }>;
          }>;
        };
      };
      const apiUnit = (json.energyDetails?.unit ?? 'Wh').toUpperCase();
      const toKwh = (v: number) =>
        apiUnit === 'WH' ? v / 1000 : apiUnit === 'MWH' ? v * 1000 : v;
      const meterByType = (type: string) =>
        json.energyDetails?.meters?.find((m) => m.type === type)?.values ?? [];

      if (this.device.type === 'house') {
        const values = meterByType('CONSUMPTION');
        return values
          .filter((v) => v.value != null)
          .map((v) => ({
            timestamp: new Date(v.date.replace(' ', 'T') + 'Z'),
            value: toKwh(v.value as number),
            unit: 'kWh',
          }));
      }
      // Grid: signed kWh (positive = imported, negative = exported).
      // Match the live grid sign convention (gridImportKw positive on
      // import) so flow / clean-energy attribution stays consistent.
      const purchased = meterByType('PURCHASED');
      const feedin = meterByType('FEEDIN');
      const feedinByTs = new Map(feedin.map((v) => [v.date, v.value ?? 0]));
      return purchased
        .filter((v) => v.value != null)
        .map((v) => ({
          timestamp: new Date(v.date.replace(' ', 'T') + 'Z'),
          value: toKwh((v.value ?? 0) - (feedinByTs.get(v.date) ?? 0)),
          unit: 'kWh',
        }));
    } catch (err) {
      console.warn(
        `[solaredge] ${this.device.name}: history fetch failed — ${
          err instanceof Error ? err.message : 'unknown'
        }; returning empty`
      );
      return [];
    }
  }

  async sendCommand(
    _command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message:
        'SolarEdge Monitoring API is read-only; control commands are not supported',
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
